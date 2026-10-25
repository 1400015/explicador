// Diagnóstico da API Gemini a partir do "ponto de vista" de um WebView Capacitor.
// NÃO usa nenhuma chave real — só testa rede, CORS e formato de erro.

const MODEL = "gemini-3.8-flash";
const BASE = "https://generativelanguage.googleapis.com";
const ENDPOINT = `${BASE}/v1beta/models/${MODEL}:generateContent`;

async function main() {
  console.log("== 1. Preflight CORS (como o browser/WebView faria) ==");
  for (const origin of ["https://localhost", "capacitor://localhost", "http://localhost"]) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type,x-goog-api-key",
        },
      });
      console.log(`origin ${origin}:`);
      console.log("  status:", res.status);
      console.log("  allow-origin:", res.headers.get("access-control-allow-origin"));
      console.log("  allow-headers:", res.headers.get("access-control-allow-headers"));
      console.log("  allow-methods:", res.headers.get("access-control-allow-methods"));
    } catch (e) {
      console.log(`origin ${origin}: ERRO DE REDE ->`, e.message, e.cause?.message ?? "");
    }
  }

  console.log("\n== 2. POST real com chave dummy (esperado: erro de auth, não de rede) ==");
  try {
    const res = await fetch(`${ENDPOINT}?key=AIzaDUMMYDUMMYDUMMYDUMMYDUMMYDUMMY1234`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "teste" }] }] }),
    });
    const text = await res.text();
    console.log("status:", res.status);
    console.log("body:", text.slice(0, 300));
  } catch (e) {
    console.log("ERRO DE REDE ->", e.message, e.cause?.message ?? "");
  }

  console.log("\n== 3. POST com header x-goog-api-key dummy ==");
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": "AIzaDUMMYDUMMYDUMMYDUMMYDUMMYDUMMY1234" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "teste" }] }] }),
    });
    const text = await res.text();
    console.log("status:", res.status);
    console.log("body:", text.slice(0, 300));
  } catch (e) {
    console.log("ERRO DE REDE ->", e.message, e.cause?.message ?? "");
  }

  console.log("\n== 4. Versão mais recente do SDK ==");
  try {
    const res = await fetch("https://registry.npmjs.org/@google/genai/latest");
    const json = await res.json();
    console.log("@google/genai latest:", json.version);
  } catch (e) {
    console.log("erro ao consultar npm:", e.message);
  }
}

main();
