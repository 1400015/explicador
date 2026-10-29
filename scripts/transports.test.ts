import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { askTutorDirect, TutorError } from "../lib/gemini-client";
import {
  moderationCheckNativeHttp,
  generateWithNativeHttp,
} from "../lib/gemini-http";
import { MODERATION_UNAVAILABLE } from "../lib/moderation";

// Este processo só usa o transporte simulado, nunca uma chave ou rede Google real.
createRequire(import.meta.url)("../tests/fixtures/gemini.cjs");
const apiKey = "AIza" + "A".repeat(35);
const params = { apiKey, subject: "geral" as const, images: [], history: [] };

test("SDK direto mostra apenas resposta aprovada", async () => {
  assert.equal(
    await askTutorDirect({ ...params, message: "oi" }),
    "Explicação simulada segura.",
  );
  await assert.rejects(
    askTutorDirect({ ...params, message: "simular indisponibilidade" }),
    (error) =>
      error instanceof TutorError && error.message === MODERATION_UNAVAILABLE,
  );
  const result = await askTutorDirect({
    ...params,
    message: "simular texto longo",
  });
  assert.equal(result.includes("FINAL_REPROVAR"), false);
});
test("adaptador HTTP nativo partilha os resultados estritos de moderação", async () => {
  assert.equal(
    await moderationCheckNativeHttp(apiKey, "texto seguro"),
    "approved",
  );
  assert.equal(
    await moderationCheckNativeHttp(apiKey, "SEM_APROVACAO"),
    "unavailable",
  );
  const raw = await generateWithNativeHttp({
    ...params,
    message: "simular texto longo",
  });
  assert.ok(raw && raw.length > 2000);
  assert.equal(await moderationCheckNativeHttp(apiKey, raw), "rejected");
});
