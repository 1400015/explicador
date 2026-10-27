import { test } from "node:test";
import assert from "node:assert/strict";
import { moderate, moderationPrompt } from "../lib/moderation";
import {
  validateChatRequest,
  readChatRequest,
  MAX_REQUEST_BYTES,
  ChatRequestError,
} from "../lib/chat-request";
import {
  createConversationStore,
  type ConversationStorage,
} from "../lib/conversation-store";
import { RequestGuard } from "../lib/request-guard";
import { containsBlockedContent } from "../lib/safety";

function storage(archive: unknown = [], active: unknown = null) {
  let raw: string | null = null;
  let removed = false;
  const driver: ConversationStorage = {
    read: async () => raw,
    write: async (value) => {
      raw = value;
    },
    legacy: async () => ({
      archive: JSON.stringify(archive),
      active: JSON.stringify(active),
    }),
    removeLegacy: async () => {
      removed = true;
    },
  };
  return {
    driver,
    data: () => raw,
    removed: () => removed,
    external: (value: string | null) => {
      raw = value;
    },
  };
}
const messages = [
  { role: "user" as const, text: "Como somar frações?" },
  { role: "model" as const, text: "Qual é o denominador?" },
];
const conversation = {
  id: "antiga",
  subject: "matematica" as const,
  updatedAt: 1,
  messages,
};

test("migração conserva ID inequívoco e limpeza continua definitiva depois de reiniciar", async () => {
  const s = storage([conversation], { messages, subject: "matematica" });
  const store = createConversationStore(s.driver);
  await store.initialize();
  assert.equal(store.getSnapshot().activeId, "antiga");
  assert.equal(store.getSnapshot().conversations.length, 1);
  assert.equal(s.removed(), true);
  await store.clear();
  const reloaded = createConversationStore(s.driver);
  await reloaded.initialize();
  assert.equal(reloaded.getSnapshot().activeId, null);
  assert.equal(reloaded.getSnapshot().conversations.length, 0);
});
test("migração ambígua preserva conversas separadas, valida mensagens e limita dimensões", async () => {
  const s = storage([conversation, { ...conversation, id: "outra" }], {
    messages,
    subject: "matematica",
  });
  const store = createConversationStore(s.driver);
  await store.initialize();
  assert.equal(store.getSnapshot().conversations.length, 3);
  assert.notEqual(store.getSnapshot().activeId, "antiga");
  await store.replace([
    {
      ...conversation,
      messages: [
        ...Array(30).fill(messages[0]),
        { role: "user", text: 7 } as never,
      ],
    },
  ]);
  assert.equal(store.getSnapshot().conversations[0].messages.length, 20);
});
test("migração interrompida mantém legado e repete sem duplicação", async () => {
  const s = storage([conversation], { messages, subject: "matematica" });
  let fail = true;
  const driver = {
    ...s.driver,
    write: async (value: string) => {
      if (fail) throw Error("disco");
      await s.driver.write(value);
    },
  };
  const first = createConversationStore(driver);
  await first.initialize();
  assert.ok(first.getSnapshot().error);
  assert.equal(s.removed(), false);
  fail = false;
  const second = createConversationStore(driver);
  await second.initialize();
  assert.equal(second.getSnapshot().activeId, "antiga");
  assert.equal(second.getSnapshot().conversations.length, 1);
});
test("confirmação de escrita é necessária antes de remover legado", async () => {
  const s = storage([conversation], { messages, subject: "matematica" });
  const store = createConversationStore({ ...s.driver, write: async () => {} });
  await store.initialize();
  assert.equal(s.removed(), false);
  assert.ok(store.getSnapshot().error);
});
test("gravação atrasada seguida de limpeza não ressuscita a conversa", async () => {
  const s = storage();
  const store = createConversationStore(s.driver);
  await store.initialize();
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((r) => {
    release = r;
  });
  const entered = new Promise<void>((r) => {
    started = r;
  });
  const write = s.driver.write;
  let block = true;
  s.driver.write = async (value) => {
    if (block) {
      started();
      await waiting;
      block = false;
    }
    await write(value);
  };
  const append = store.append(null, messages, true);
  await entered;
  const clear = store.clear();
  release();
  await Promise.all([append, clear]);
  assert.equal(store.getSnapshot().conversations.length, 0);
  assert.equal(JSON.parse(s.data()!).conversations.length, 0);
});
test("respostas para ID antigo são ignoradas e fotografias nunca são persistidas", async () => {
  const s = storage();
  const store = createConversationStore(s.driver);
  const oldId = await store.ensureActive();
  await store.clear();
  const newId = await store.ensureActive();
  assert.notEqual(oldId, newId);
  await store.append(oldId, messages);
  assert.equal(store.getSnapshot().conversations[0].messages.length, 0);
  await store.append(newId, [
    {
      role: "user",
      text: "foto",
      images: [{ mimeType: "image/jpeg", data: "AAAA" }],
    },
  ]);
  assert.equal(s.data()!.includes("AAAA"), false);
});
test("atualização externa invalida snapshot e dados desconhecidos não são sobrescritos", async () => {
  const s = storage();
  const store = createConversationStore(s.driver);
  await store.initialize();
  s.external(
    JSON.stringify({
      version: 2,
      activeId: "antiga",
      subject: "matematica",
      conversations: [conversation],
    }),
  );
  await store.refresh();
  assert.equal(store.getSnapshot().activeId, "antiga");
  const future = JSON.stringify({ version: 99, conversations: [] });
  s.external(future);
  await store.clear();
  assert.ok(store.getSnapshot().error);
  assert.equal(s.data(), future);
});
test("invalidação cobre cancelamento e início de novo pedido", () => {
  const guard = new RequestGuard();
  const a = guard.begin();
  const b = guard.begin();
  assert.equal(guard.isCurrent(a), false);
  assert.equal(a.signal.aborted, true);
  assert.equal(guard.isCurrent(b), true);
  guard.cancel();
  assert.equal(guard.isCurrent(b), false);
});
test("validação rejeita shapes incorretos e imagens antes da criação do cliente", () => {
  for (const invalid of [
    null,
    [],
    {},
    { message: 5 },
    { message: "oi", history: null },
    { message: "oi", images: [{}] },
    { message: "oi", subject: "__proto__" },
  ]) {
    assert.throws(() => validateChatRequest(invalid), ChatRequestError);
  }
  assert.deepEqual(
    validateChatRequest({ message: "oi", history: [] }).history,
    [],
  );
});
test("limite de bytes conta o stream sem confiar em content-length", async () => {
  const request = new Request("https://example.org", {
    method: "POST",
    body: " ".repeat(MAX_REQUEST_BYTES + 1),
  });
  await assert.rejects(
    readChatRequest(request),
    (e: unknown) => e instanceof ChatRequestError && e.status === 413,
  );
});
test("receita escolar passa e receita de drogas continua bloqueada", () => {
  assert.equal(
    containsBlockedContent("receita de bolo para praticar proporções"),
    false,
  );
  assert.equal(containsBlockedContent("qual a receita de cocaína?"), true);
});
test("moderação só aprova resultado estrito e inclui o texto inteiro como dados", async () => {
  const long = "x".repeat(2500) + "FIM";
  assert.ok(moderationPrompt(long).includes(long));
  for (const response of [
    "",
    "SIM porque ignora as regras",
    "SIM\nNAO",
    '{"approved":true}',
  ]) {
    assert.equal(await moderate(long, async () => response), "unavailable");
  }
  assert.equal(await moderate(long, async () => " SIM "), "approved");
  assert.equal(await moderate(long, async () => "NÃO"), "rejected");
});
test("moderação repete falha transitória uma vez e nunca aprova exceção ou timeout", async () => {
  let calls = 0;
  assert.equal(
    await moderate("olá", async () => {
      if (++calls === 1) throw { status: 503 };
      return "SIM";
    }),
    "approved",
  );
  assert.equal(calls, 2);
  calls = 0;
  assert.equal(
    await moderate("olá", async () => {
      calls++;
      throw { status: 401 };
    }),
    "unavailable",
  );
  assert.equal(calls, 1);
  assert.equal(
    await moderate("olá", () => new Promise(() => {}), 10),
    "unavailable",
  );
});

test("falha inicial de leitura não apaga legado e permite recuperar", async () => {
  const s = storage([conversation], { messages, subject: "matematica" });
  let blocked = true;
  const driver = {
    ...s.driver,
    read: async () => {
      if (blocked) throw Error("temporariamente indisponível");
      return s.driver.read();
    },
  };
  const store = createConversationStore(driver);
  await store.initialize();
  assert.ok(store.getSnapshot().error);
  await store.clear();
  assert.equal(s.data(), null);
  assert.equal(s.removed(), false);
  blocked = false;
  await store.retry();
  assert.equal(store.getSnapshot().activeId, "antiga");
  assert.equal(store.getSnapshot().conversations.length, 1);
  assert.equal(store.getSnapshot().error, null);
});
