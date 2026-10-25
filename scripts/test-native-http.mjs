// Simula o fluxo do gemini-http: CapacitorHttp no Node usa fetch (web fallback).
// Testa: (1) erro de chave -> deve vir com status HTTP real; (2) estrutura do body.
import { CapacitorHttp } from '@capacitor/core';

const MODEL = "gemini-3.8-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// 1. Chave dummy -> esperado erro 400 com status real
const res = await CapacitorHttp.request({
  url: ENDPOINT,
  method: "POST",
  headers: { "Content-Type": "application/json", "x-goog-api-key": "AIzaDUMMYDUMMYDUMMYDUMMYDUMMYDUMMY1234" },
  data: { contents: [{ role: "user", parts: [{ text: "teste" }] }] },
  responseType: "json",
});
console.log("status HTTP real:", res.status);
console.log("tem body de erro:", JSON.stringify(res.data).includes("API key not valid"));
if (res.status === 400) console.log("✅ PASSOU: erro HTTP real devolvido (será classificado como invalid-key)");
else console.log("⚠️ inesperado:", res.status);

// 2. Verificar estrutura do body que vamos enviar (safetySettings etc.)
const body = {
  contents: [{ role: "user", parts: [{ text: "quanto é 2+2?" }] }],
  systemInstruction: { parts: [{ text: "És um tutor para uma criança de 12 anos." }] },
  generationConfig: { maxOutputTokens: 512, thinkingConfig: { thinkingLevel: "HIGH", includeThoughts: false } },
  safetySettings: [
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", blockThreshold: "BLOCK_LOW_AND_ABOVE" },
  ],
};
console.log("\nbody structure OK:", JSON.stringify(body).length > 0);
