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
  // Ambiente de armazenamento realista, isolado deste processo de testes.
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } });

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
  ok("modelo por defeito é o Gemini 3.6 Flash", MODEL === "gemini-3.6-flash");
  ok("nível de raciocínio interativo é LOW", THINKING_LEVEL === "LOW");

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

  console.log("== gemini-http.ts (body REST correto + normalizeNativeError) ==");
  const httpMod = await import("../lib/gemini-http");
  ok("normalizeNativeError extrai status de texto", httpMod.normalizeNativeError(new Error("Response with status code 429")).status === 429);
  ok("normalizeNativeError extrai status genérico", httpMod.normalizeNativeError(new Error("HTTP 401 error")).status === 401);
  ok("normalizeNativeError sem status -> undefined", httpMod.normalizeNativeError(new Error("network down"))?.status === undefined);
  ok("normalizeNativeError mantém erro já normalizado", (() => {
    const e = new Error("x") as Error & { status?: number }; e.status = 400;
    return httpMod.normalizeNativeError(e).status === 400;
  })());
  ok("makeApiError tem status e message JSON", (() => {
    const e = httpMod.makeApiError(400, { error: { code: 400, message: "bad" } });
    return e.status === 400 && e.message.includes('"code":400');
  })());
  // Verificar que o body REST usa "threshold" (não "blockThreshold") — extrair via source
  const { readFileSync } = await import("node:fs");
  const httpSrc = readFileSync(new URL("../lib/gemini-http.ts", import.meta.url), "utf-8");
  ok("body REST usa 'threshold' (não blockThreshold)", httpSrc.includes("threshold:") && !httpSrc.includes("blockThreshold"));

  console.log("== v1.1.5: historico sem imagens + user-first ==");
  const { prepareHistory, buildGeminiBody } = httpMod as unknown as {
    prepareHistory: (h: Array<{ role: "user" | "model"; text: string; images?: unknown[] }>) => Array<{ role: string; text: string }>;
    buildGeminiBody: (p: { message: string; history: unknown[]; subject: string; images: unknown[] }) => { contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> };
  };
  const img = { mimeType: "image/jpeg", data: "QUJD" };
  const histWithImgs = [
    { role: "user" as const, text: "olha esta foto", images: [img] },
    { role: "model" as const, text: "o que queres saber?", images: [img, img] },
    { role: "user" as const, text: "a equacao", images: [img] },
  ];
  const prepared = prepareHistory(histWithImgs);
  ok("prepareHistory remove imagens do historico", prepared.every((m) => (m as { images?: unknown }).images === undefined));
  ok("prepareHistory comeca por user", prepared[0].role === "user");
  const oddHist = [
    { role: "model" as const, text: "resposta antiga" },
    { role: "user" as const, text: "pergunta" },
  ];
  ok("prepareHistory corta model inicial", prepareHistory(oddHist)[0].role === "user");
  const longHist = Array.from({ length: 30 }, (_, i) => ({
    role: (i % 2 === 0 ? "user" : "model") as "user" | "model",
    text: `msg ${i}`,
  }));
  ok("prepareHistory limita a 20 mensagens", prepareHistory(longHist).length === 20);
  const body = buildGeminiBody({ message: "pergunta nova", history: histWithImgs, subject: "geral", images: [img] });
  const histParts = body.contents.slice(0, -1).flatMap((c) => c.parts);
  ok("buildGeminiBody nao envia imagens do historico", histParts.every((p) => p.inlineData === undefined));
  ok("buildGeminiBody envia imagens da mensagem atual", body.contents.at(-1)!.parts.some((p) => p.inlineData !== undefined));
  ok("buildGeminiBody termina em user", body.contents.at(-1)!.role === "user");

  console.log("== v1.1.5: classifyApiError novos mapeamentos ==");
  ok("413 -> too-large", classifyApiError(sdkErr(413, { error: { code: 413, message: "payload too large" } })) === "too-large");
  ok("408 -> too-large", classifyApiError(sdkErr(408, { error: { code: 408 } })) === "too-large");
  ok("500 -> overloaded", classifyApiError(sdkErr(500, { error: { code: 500, status: "INTERNAL", message: "boom" } })) === "overloaded");
  ok("502 -> overloaded", classifyApiError(sdkErr(502, { error: { code: 502 } })) === "overloaded");
  ok("504 -> overloaded", classifyApiError(sdkErr(504, { error: { code: 504 } })) === "overloaded");
  ok("DEADLINE_EXCEEDED -> overloaded", classifyApiError(sdkErr(400, { error: { code: 400, status: "DEADLINE_EXCEEDED", message: "slow" } })) === "overloaded");
  ok("timeout na mensagem -> network", classifyApiError(new Error("Error: timeout of 120000ms exceeded")) === "network");
  ok("AbortError -> network", (() => {
    const e = new Error("The operation was aborted"); e.name = "AbortError";
    return classifyApiError(e) === "network";
  })());
  ok("socket hang up -> network", classifyApiError(new Error("socket hang up")) === "network");
  ok("msg too-large menciona fotos", friendlyApiError(sdkErr(413, { error: { code: 413 } })).includes("fotos"));
  ok("msg overloaded aponta para referência", friendlyApiError(sdkErr(503, { error: { code: 503 } })).toLowerCase().includes("referência"));
  ok("msg network menciona Wi-Fi", friendlyApiError(new TypeError("Failed to fetch")).includes("Wi-Fi"));

  console.log(`\n✅ Todos os ${passed} testes passaram.`);
}

main().catch((err) => {
  console.error("❌ FALHOU:", err);
  process.exit(1);
});
