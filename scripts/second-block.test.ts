import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSettingsStore,
  type SettingsStorage,
} from "../lib/settings-store";
import { createPinSecurity, type PinAttempts } from "../lib/pin-security";
import { hashPin, verifyPin, type PinHash } from "../lib/pin";
import { createTutorTransport, serverEndpoint } from "../lib/transport-core";
import { thinkingLevel, modelName } from "../lib/model-config";

const KEY = "AIza" + "A".repeat(35);
const question = {
  message: "Como estudar?",
  subject: "geral" as const,
  history: [],
  images: [],
};
function driver(native = true, settings: unknown = null) {
  let json: string | null = settings === null ? null : JSON.stringify(settings);
  const keys = new Map<boolean, string>();
  const storage: SettingsStorage = {
    native,
    read: async () => json,
    write: async (value) => {
      json = value;
    },
    getKey: async (persist) => keys.get(native || persist) ?? null,
    setKey: async (value, persist) => {
      keys.set(native || persist, value);
    },
    removeKey: async (persist) => {
      keys.delete(native || persist);
    },
  };
  return { storage, raw: () => json, keys };
}

test("migração nativa confirma segredo antes de retirar plaintext e repete sem o duplicar", async () => {
  const d = driver(true, {
    mode: "direct",
    apiKey: KEY,
    serverUrl: "",
    pin: null,
  });
  const store = createSettingsStore(d.storage);
  assert.equal((await store.load()).apiKey, KEY);
  assert.equal(d.raw()!.includes(KEY), false);
  assert.equal(d.keys.get(true), KEY);
  assert.equal((await createSettingsStore(d.storage).load()).apiKey, KEY);
  await store.clear();
  assert.equal(d.keys.size, 0);
  assert.equal((await createSettingsStore(d.storage).load()).apiKey, "");
});
test("falhas em gravação e confirmação preservam legado e PIN", async () => {
  const pin = await hashPin("1234", "salt");
  for (const step of ["write", "confirm", "metadata"]) {
    const legacy = { mode: "direct", apiKey: KEY, pin };
    const d = driver(true, legacy);
    if (step === "write")
      d.storage.setKey = async () => {
        throw Error("cofre indisponível");
      };
    if (step === "confirm") d.storage.getKey = async () => null;
    if (step === "metadata")
      d.storage.write = async () => {
        throw Error("disco");
      };
    const value = await createSettingsStore(d.storage).load();
    assert.ok(value.apiKeyIssue);
    assert.equal(value.apiKey, "");
    assert.deepEqual(value.pin, pin);
    assert.equal(d.raw(), JSON.stringify(legacy));
  }
});
test("segredo inacessível não abre definições protegidas e trocar PIN não remove segredo", async () => {
  const pin = await hashPin("1234", "salt");
  const d = driver(true, { mode: "direct", pin });
  d.storage.getKey = async () => {
    throw Error("Keystore ausente");
  };
  let removed = false;
  d.storage.removeKey = async () => {
    removed = true;
  };
  const store = createSettingsStore(d.storage);
  assert.deepEqual((await store.load()).pin, pin);
  await store.setPin(pin);
  assert.equal(removed, false);
  assert.equal(JSON.parse(d.raw()!).pin.hash, pin.hash);
});
test("definições inválidas não são substituídas por um PIN ausente", async () => {
  const d = driver(true, { pin: { hash: "inválido", salt: "salt" } });
  await assert.rejects(createSettingsStore(d.storage).load());
  assert.ok(d.raw()!.includes("inválido"));
});
test("browser usa sessão por defeito e migra persistência apenas depois de confirmar", async () => {
  const d = driver(false);
  const store = createSettingsStore(d.storage);
  const settings = await store.load();
  await store.save({ ...settings, mode: "direct", apiKey: KEY });
  assert.equal(d.keys.get(false), KEY);
  assert.equal(d.keys.has(true), false);
  assert.equal(d.raw()!.includes(KEY), false);
  await store.save({
    ...settings,
    mode: "direct",
    apiKey: KEY,
    persistApiKey: true,
  });
  assert.equal(d.keys.get(true), KEY);
  assert.equal(d.keys.has(false), false);
  await store.clear();
  assert.equal(d.keys.size, 0);
});
test("falha ao mudar persistência não apaga cópia anterior nem anuncia sucesso", async () => {
  const d = driver(false);
  const store = createSettingsStore(d.storage);
  const settings = await store.load();
  await store.save({ ...settings, apiKey: KEY, mode: "direct" });
  d.storage.write = async () => {
    throw Error("quota");
  };
  await assert.rejects(
    store.save({ ...settings, apiKey: KEY, persistApiKey: true }),
  );
  assert.equal(d.keys.get(false), KEY);
});

test("quatro percursos de transporte usam destino e origem da chave esperados", async () => {
  for (const native of [false, true])
    for (const mode of ["direct", "server"] as const) {
      const calls: unknown[][] = [];
      const transport = createTutorTransport({
        native: () => native,
        direct: async (params) => {
          calls.push(["google", params.apiKey]);
          return "ok";
        },
        server: async (url, body, _signal, bridge) => {
          calls.push([url, body, bridge]);
          return { status: 200, data: { reply: "ok" } };
        },
      });
      const settings = {
        mode,
        apiKey: KEY,
        serverUrl: "https://servidor.example",
      };
      assert.equal(await transport(settings, question), "ok");
      assert.equal(
        await transport(settings, { ...question, message: "Teste de ligação" }),
        "ok",
      );
      if (mode === "direct")
        assert.deepEqual(calls, [
          ["google", KEY],
          ["google", KEY],
        ]);
      else {
        assert.equal(
          calls[0][0],
          native ? "https://servidor.example/api/chat" : "/api/chat",
        );
        assert.equal(JSON.stringify(calls).includes(KEY), false);
        assert.equal(calls[0][2], native);
      }
    }
});
test("servidor HTTP exige opção explícita e rede local; URL não transporta credenciais", () => {
  for (const value of [
    "http://example.com",
    "http://192.168.1.2",
    "ftp://192.168.1.2",
    "https://user:pass@example.com",
    "https://example.com?q=secret",
    "https://example.com/#secret",
  ]) {
    assert.throws(() => serverEndpoint(value));
  }
  assert.equal(
    serverEndpoint("http://192.168.1.2:3000", true),
    "http://192.168.1.2:3000/api/chat",
  );
  assert.equal(
    serverEndpoint("http://[::1]:3000", true),
    "http://[::1]:3000/api/chat",
  );
  assert.throws(() => serverEndpoint("http://example.com", true));
});
test("falha de TLS não muda de percurso nem tenta outro destino", async () => {
  let direct = 0,
    server = 0;
  const transport = createTutorTransport({
    native: () => true,
    direct: async () => {
      direct++;
      return "ok";
    },
    server: async () => {
      server++;
      throw Error("TLS");
    },
  });
  await assert.rejects(
    transport(
      { mode: "server", apiKey: KEY, serverUrl: "https://example.com" },
      question,
    ),
    /TLS/,
  );
  assert.equal(direct, 0);
  assert.equal(server, 1);
});
test("prazo total e cancelamento terminam pedido sem fallback", async () => {
  const transport = createTutorTransport(
    {
      native: () => false,
      direct: () => new Promise(() => {}),
      server: () => new Promise(() => {}),
    },
    5,
  );
  await assert.rejects(
    transport({ mode: "direct", apiKey: KEY, serverUrl: "" }, question),
    /demorou/,
  );
  const cancel = new AbortController();
  cancel.abort();
  await assert.rejects(
    transport(
      { mode: "direct", apiKey: KEY, serverUrl: "" },
      { ...question, signal: cancel.signal },
    ),
    /interrompido/,
  );
});

test("PIN legado migra para PBKDF2 e atraso sobrevive à reabertura", async () => {
  let saved: PinHash | null = await hashPin("4321", "salt");
  let attempts: PinAttempts = { failures: 0, blockedUntil: 0 };
  let now = 1000;
  const deps = {
    read: async () => attempts,
    write: async (value: PinAttempts) => {
      attempts = value;
    },
    current: async () => saved,
    upgrade: async (value: PinHash) => {
      saved = value;
    },
    now: () => now,
  };
  const verify = createPinSecurity(deps);
  for (let i = 0; i < 3; i++) assert.equal(await verify("1111"), false);
  const reopened = createPinSecurity(deps);
  await assert.rejects(reopened("4321"), /Aguarda/);
  now += 1001;
  assert.equal(await reopened("4321"), true);
  assert.equal(saved!.version, 2);
  assert.equal(await verifyPin("4321", saved!), true);
  assert.deepEqual(attempts, { failures: 0, blockedUntil: 0 });
});
test("falha de persistência da proteção não produz desbloqueio bem-sucedido", async () => {
  const pin = await hashPin("4321", "salt");
  const verify = createPinSecurity({
    read: async () => ({ failures: 0, blockedUntil: 0 }),
    write: async () => {
      throw Error("disco");
    },
    current: async () => pin,
    upgrade: async () => {},
  });
  await assert.rejects(verify("4321"), /disco/);
});
test("modelo e raciocínio são configuráveis mas endpoints e nomes inválidos são rejeitados", () => {
  assert.equal(modelName("gemini-3.8-flash"), "gemini-3.8-flash");
  assert.equal(thinkingLevel("LOW"), "LOW");
  assert.throws(() => modelName("https://example.com"));
  assert.throws(() => modelName("../outro"));
  assert.throws(() => thinkingLevel("INFINITO"));
});
