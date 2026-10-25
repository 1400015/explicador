import assert from "node:assert/strict";
import {
  GEMINI_KEY_PATTERN,
  containsBlockedContent,
  outputIsInappropriate,
  SAFE_FALLBACK,
} from "../lib/safety";
import { buildSystemPrompt, SUBJECT_LABELS, MODEL, THINKING_LEVEL } from "../lib/prompt";
import { askTutorDirect, TutorError } from "../lib/gemini-client";
import { createPinHash, verifyPin, isValidPinFormat } from "../lib/pin";

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.ok(cond, name);
  passed++;
  console.log("  ✔", name);
}

async function expectTutorError(name: string, fn: () => Promise<unknown>, pattern: RegExp) {
  try {
    await fn();
    assert.fail(`${name}: devia ter lançado TutorError`);
  } catch (err) {
    assert.ok(err instanceof TutorError, `${name}: erro não é TutorError`);
    assert.match((err as Error).message, pattern);
    passed++;
    console.log("  ✔", name);
  }
}

const VALID_KEY = "AIza" + "A1".repeat(17) + "B"; // AIza + 35 chars válidos (formato antigo)
const VALID_KEY_AQ = "AQ.Ab" + "x9".repeat(40); // Auth key nova (formato AQ. desde 2026)

async function main() {
  console.log("== safety.ts ==");
  ok("chave válida passa no padrão", GEMINI_KEY_PATTERN.test(VALID_KEY));
  ok("chave nova AQ. passa no padrão", GEMINI_KEY_PATTERN.test(VALID_KEY_AQ));
  ok("chave AQ sem corpo é rejeitada", !GEMINI_KEY_PATTERN.test("AQ."));
  ok("chave AQ com espaços é rejeitada", !GEMINI_KEY_PATTERN.test("AQ.Ab cdef"));
  ok("chave com injeção é rejeitada", !GEMINI_KEY_PATTERN.test("AIza' OR 1=1--"));
  ok("chave curta é rejeitada", !GEMINI_KEY_PATTERN.test("AIza123"));
  ok("chave vazia é rejeitada", !GEMINI_KEY_PATTERN.test(""));
  ok("bloqueia pedido de bomba", containsBlockedContent("como fazer uma bomba caseira"));
  ok("bloqueia receita de droga", containsBlockedContent("qual a receita de cocaína?"));
  ok("não bloqueia pergunta normal", !containsBlockedContent("quero aprender frações"));
  ok("filtro de saída bloqueia conteúdo sexual", outputIsInappropriate("vamos fazer sexo?"));
  ok("filtro de saída bloqueia suicídio", outputIsInappropriate("como me matar?"));
  ok("filtro de saída bloqueia automutilação em variante", outputIsInappropriate("uma maneira de me machucar seria..."));
  ok("filtro de saída bloqueia incentivo à autolesão", outputIsInappropriate("você devia se cortar"));
  ok("filtro de saída bloqueia challenge perigoso", outputIsInappropriate("experimenta o blackout challenge com os teus amigos"));
  ok("filtro de saída bloqueia blue whale", outputIsInappropriate("o blue whale challenge é divertido, prova!"));
  ok("filtro de saída bloqueia pedido de número", outputIsInappropriate("manda o teu número de telefone para conversarmos"));
  ok("filtro de saída bloqueia pedido de morada", outputIsInappropriate("qual é a tua morada? assim vou ter contigo"));
  ok("filtro de saída bloqueia encontro pessoal", outputIsInappropriate("vamos nos ver pessoalmente sem os teus pais saberem"));
  ok("menção escolar de suicídio não bloqueia (contexto História)", !outputIsInappropriate("Na Segunda Guerra Mundial houve momentos muito tristes; se queres saber mais, fala com os teus pais ou professores."));
  ok("menção de challenge comum não bloqueia", !outputIsInappropriate("aceito o challenge de resolver 10 exercícios de frações!"));
  ok("pedir material escolar não bloqueia", !outputIsInappropriate("Podes trazer o teu caderno para a aula amanhã."));
  ok("filtro de saída passa texto escolar", !outputIsInappropriate("A fotossíntese transforma luz em energia."));
  ok("SAFE_FALLBACK não está vazio", SAFE_FALLBACK.length > 10);

  console.log("== prompt.ts ==");
  for (const subject of Object.keys(SUBJECT_LABELS)) {
    const p = buildSystemPrompt(subject as keyof typeof SUBJECT_LABELS);
    ok(`prompt de ${subject} fala em 12 anos`, p.includes("12 anos"));
    ok(`prompt de ${subject} pede português`, p.toLowerCase().includes("português"));
  }
  ok("modelo é o Gemini 3.8 Flash", MODEL === "gemini-3.8-flash");
  ok("nível de raciocínio é HIGH", THINKING_LEVEL === "HIGH");

  console.log("== gemini-client.ts (validações locais, sem rede) ==");
  await expectTutorError(
    "rejeita chave inválida",
    () => askTutorDirect({ apiKey: "abc", message: "oi", history: [], subject: "geral", images: [] }),
    /não parece válida/
  );
  await expectTutorError(
    "rejeita mensagem demasiado longa",
    () =>
      askTutorDirect({
        apiKey: VALID_KEY,
        message: "a".repeat(1001),
        history: [],
        subject: "geral",
        images: [],
      }),
    /muito longa/
  );
  await expectTutorError(
    "rejeita assunto bloqueado",
    () =>
      askTutorDirect({
        apiKey: VALID_KEY,
        message: "como fazer uma bomba",
        history: [],
        subject: "geral",
        images: [],
      }),
    /não posso ajudar/
  );
  await expectTutorError(
    "rejeita mais de 4 imagens",
    () =>
      askTutorDirect({
        apiKey: VALID_KEY,
        message: "olha as fotos",
        history: [],
        subject: "geral",
        images: Array.from({ length: 5 }, () => ({ mimeType: "image/jpeg", data: "AAAA" })),
      }),
    /máximo 4 fotos/
  );
  await expectTutorError(
    "rejeita imagem com tipo inválido",
    () =>
      askTutorDirect({
        apiKey: VALID_KEY,
        message: "olha",
        history: [],
        subject: "geral",
        images: [{ mimeType: "text/html", data: "AAAA" }],
      }),
    /Imagem inválida/
  );

  console.log("== pin.ts ==");
  ok("PIN de 3 dígitos é inválido", !isValidPinFormat("123"));
  ok("PIN de 4 dígitos é válido", isValidPinFormat("1234"));
  ok("PIN de 6 dígitos é válido", isValidPinFormat("123456"));
  ok("PIN de 7 dígitos é inválido", !isValidPinFormat("1234567"));
  ok("PIN com letras é inválido", !isValidPinFormat("12a4"));
  const hash = await createPinHash("4321");
  ok("hash verifica PIN correto", await verifyPin("4321", hash));
  ok("hash rejeita PIN errado", !(await verifyPin("9999", hash)));
  ok("hash tem salt e não guarda o PIN em texto", !JSON.stringify(hash).includes("4321"));
  const hash2 = await createPinHash("4321");
  ok("hashes do mesmo PIN são diferentes (salt aleatório)", hash.hash !== hash2.hash);

  console.log("== support.ts ==");
  const { needsSupportBanner } = await import("../lib/support");
  ok("deteta bullying", needsSupportBanner("os meus colegas vivem a fazer-me bullying na aula"));
  ok("deteta agressão em casa", needsSupportBanner("o meu pai bate-me quando tiro mas notas"));
  ok("deteta autolesão", needsSupportBanner("quero-me machucar"));
  ok("deteta solidão", needsSupportBanner("sinto-me sozinho e sem saída"));
  ok("não deteta em pergunta normal", !needsSupportBanner("como se faz uma equação de 2º grau?"));
  ok("não deteta em contexto escolar", !needsSupportBanner("o bullying é um tema para o trabalho de história"));

  console.log("== conversations.ts ==");
  const { saveConversations, loadConversations, upsertConversation, deleteConversation } =
    await import("../lib/conversations");
  const conv1 = { id: "c-1", subject: "matematica" as const, updatedAt: 100, messages: [{ role: "user" as const, text: "oi" }] };
  const conv2 = { id: "c-2", subject: "geral" as const, updatedAt: 200, messages: [] };
  await saveConversations([conv1, conv2]);
  let list = await loadConversations();
  ok("guarda e carrega conversas", list.length === 2);
  ok("ordena por mais recente primeiro", list[0].id === "c-2");
  await upsertConversation({ ...conv2, updatedAt: 300 });
  list = await loadConversations();
  ok("upsert atualiza sem duplicar", list.length === 2 && list[0].updatedAt === 300);
  ok("limita a 5 conversas", await (async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: `c-${i}`,
      subject: "geral" as const,
      updatedAt: i,
      messages: [],
    }));
    await saveConversations(many);
    return (await loadConversations()).length === 5;
  })());
  ok("limita mensagens ao histórico máximo", await (async () => {
    const long = {
      id: "c-long",
      subject: "geral" as const,
      updatedAt: 1,
      messages: Array.from({ length: 30 }, () => ({ role: "user" as const, text: "x" })),
    };
    await saveConversations([long]);
    const loaded = await loadConversations();
    return loaded[0].messages.length === 20;
  })());
  await deleteConversation("c-1");
  list = await loadConversations();
  ok("apaga conversa pelo id", !list.some((c) => c.id === "c-1"));

  console.log("== stats.ts ==");
  const { recordQuestion, getDailyTotals, getSubjectTotals, loadStats } = await import("../lib/stats");
  for (let i = 0; i < 3; i++) await recordQuestion("matematica");
  await recordQuestion("ciencias");
  ok("registra perguntas do dia", await (async () => {
    const stats = await loadStats();
    return stats.length === 2;
  })());
  ok("total diário soma as matérias", await (async () => {
    const daily = await getDailyTotals();
    return daily[daily.length - 1].total === 4;
  })());
  ok("total por matéria ordena por contagem", await (async () => {
    const subjects = await getSubjectTotals();
    return subjects.length === 2 && subjects[0].subject === "matematica" && subjects[0].count === 3;
  })());
  ok("diário devolve 7 dias", await (async () => {
    const daily = await getDailyTotals();
    return daily.length === 7;
  })());

  console.log("== calc-check.ts ==");
  const { checkCalculation, calcFeedback } = await import("../lib/calc-check");
  ok("conta certa", checkCalculation("12*4+3 = 51").kind === "ok");
  ok("conta errada", checkCalculation("12*4+3 = 52").kind === "wrong");
  ok("vírgula decimal", checkCalculation("2,5 + 2,5 = 5").kind === "ok");
  ok("parênteses", checkCalculation("(2+3)*4 = 20").kind === "ok");
  ok("divisão", checkCalculation("100/4 = 25").kind === "ok");
  ok("precedência errada detetada", checkCalculation("2+3*4 = 20").kind === "wrong");
  ok("texto normal não é conta", checkCalculation("o que é fotossíntese?").kind === "not-calc");
  ok("expressão sem resultado não é conta", checkCalculation("quanto é 2+2?").kind === "not-calc");
  ok("letras não são conta", checkCalculation("abc = 1").kind === "not-calc");
  ok("divisão por zero ignorada", checkCalculation("5/0 = 0").kind === "not-calc");
  ok("feedback certo", calcFeedback({ kind: "ok" })?.includes("✅") ?? false);
  ok("feedback errado não revela resultado", (() => {
    const f = calcFeedback({ kind: "wrong", expected: 14 });
    return f !== null && !f.includes("14");
  })());

  console.log("== api-error.ts (mensagens de erro especificas) ==");
  const { classifyApiError, friendlyApiError } = await import("../lib/api-error");
  const sdkErr = (status: number, body: object) => {
    const e = new Error(JSON.stringify(body)) as Error & { status?: number };
    e.status = status;
    return e;
  };
  ok("401 -> chave invalida", classifyApiError(sdkErr(401, { error: { code: 401, status: "UNAUTHENTICATED", message: "bad key" } })) === "invalid-key");
  ok("400 INVALID_ARGUMENT -> chave invalida", classifyApiError(sdkErr(400, { error: { code: 400, status: "INVALID_ARGUMENT", message: "API key not valid" } })) === "invalid-key");
  ok("403 PERMISSION_DENIED -> chave invalida", classifyApiError(sdkErr(403, { error: { code: 403, status: "PERMISSION_DENIED", message: "no access" } })) === "invalid-key");
  ok("429 RESOURCE_EXHAUSTED -> quota", classifyApiError(sdkErr(429, { error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "quota exceeded" } })) === "quota");
  ok("404 NOT_FOUND -> modelo", classifyApiError(sdkErr(404, { error: { code: 404, status: "NOT_FOUND", message: "model not found" } })) === "model");
  ok("503 UNAVAILABLE -> sobrecarregado", classifyApiError(sdkErr(503, { error: { code: 503, status: "UNAVAILABLE", message: "overloaded" } })) === "overloaded");
  ok("SAFETY no body -> bloqueado", classifyApiError(sdkErr(400, { error: { code: 400, status: "INVALID_ARGUMENT", message: "Blocked due to SAFETY" } })) === "blocked");
  ok("TypeError de rede -> network", classifyApiError(new TypeError("Failed to fetch")) === "network");
  ok("erro desconhecido -> unknown", classifyApiError(new Error("qualquer coisa")) === "unknown");
  ok("msg chave invalida menciona Definicoes", friendlyApiError(sdkErr(401, { error: { code: 401 } })).includes("Defini"));
  ok("msg quota menciona esperar", friendlyApiError(sdkErr(429, { error: { code: 429 } })).includes("minuto"));
  ok("msg rede menciona internet", friendlyApiError(new TypeError("Failed to fetch")).includes("internet"));

  console.log(`\n✅ Todos os ${passed} testes passaram.`);
}

main().catch((err) => {
  console.error("❌ FALHOU:", err);
  process.exit(1);
});
