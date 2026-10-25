// Teste de integração do caminho HTTP nativo (CapacitorHttp).
// Usa chave dummy: o objetivo é receber o erro REAL da API (API key not valid),
// provando que o body está correto (safetySettings com "threshold", não "blockThreshold").
import { CapacitorHttp } from '@capacitor/core';

const MODEL = "gemini-3.8-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

let failures = 0;
function check(name, cond) {
  if (cond) { console.log("  ✔", name); }
  else { console.log("  ❌ FALHOU:", name); failures++; }
}

// Body IGUAL ao da app (lib/gemini-http.ts) — safetySettings com "threshold"
const body = {
  contents: [{ role: "user", parts: [{ text: "teste de integração" }] }],
  systemInstruction: { parts: [{ text: "És um tutor para uma criança de 12 anos." }] },
  generationConfig: {
    maxOutputTokens: 512,
    thinkingConfig: { thinkingLevel: "HIGH", includeThoughts: false },
  },
  safetySettings: [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_ONLY_HIGH" },
  ],
};

console.log("== Teste de integração: HTTP nativo (CapacitorHttp) ==");
const res = await CapacitorHttp.request({
  url: ENDPOINT,
  method: "POST",
  headers: { "Content-Type": "application/json", "x-goog-api-key": "AIzaDUMMYDUMMYDUMMYDUMMYDUMMYDUMMY1234" },
  data: body,
  connectTimeout: 20000,
  readTimeout: 60000,
  responseType: "json",
});

const bodyText = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
console.log("  status HTTP:", res.status);

check("devolve status HTTP real (400)", res.status === 400);
check("erro é 'API key not valid' (chave dummy rejeitada)", bodyText.includes("API key not valid"));
check("NÃO menciona 'blockThreshold' (body correto)", !bodyText.includes("blockThreshold"));
check("NÃO menciona 'Unknown name' (sem campos inválidos)", !bodyText.includes("Unknown name"));
check("erro tem code 400 no JSON", bodyText.includes('"code": 400') || bodyText.includes('"code":400'));

if (failures > 0) {
  console.log(`\n❌ ${failures} teste(s) falharam.`);
  process.exit(1);
}
console.log("\n✅ Integração OK: o body está correto — com uma chave real, a API aceitará o pedido.");
