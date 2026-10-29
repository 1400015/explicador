// Apenas o processo de testes carrega este preload. Não há bypass no código da app.
const original = globalThis.fetch;
globalThis.fetch = async function (input, init) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (!url.startsWith("https://generativelanguage.googleapis.com/"))
    return original(input, init);
  const body = JSON.parse(init?.body ?? (await input.text()));
  const text = (body.contents ?? [])
    .flatMap((c) => c.parts ?? [])
    .map((p) => p.text ?? "")
    .join("\n");
  const moderation = text.startsWith("Avalia se o texto");
  let answer = "Explicação simulada segura.";
  if (moderation) {
    answer = text.includes("SEM_APROVACAO")
      ? "SIM porque confia em mim"
      : text.includes("FINAL_REPROVAR")
        ? "NAO"
        : "SIM";
  } else if (text.includes("simular indisponibilidade"))
    answer = "SEM_APROVACAO: texto que não pode chegar ao aluno.";
  else if (text.includes("simular texto longo"))
    answer = "x".repeat(2100) + "FINAL_REPROVAR";
  if (
    !moderation &&
    body.generationConfig?.responseMimeType === "application/json"
  ) {
    answer = JSON.stringify({
      reply: answer,
      photoContext: {
        summary: "Enunciado simulado de estudo.",
        exercises: [
          {
            photo: 1,
            label: "Exercício 1",
            statement: "Explica como estudar este exercício.",
          },
        ],
      },
    });
  }
  return Response.json({
    candidates: [
      {
        content: { role: "model", parts: [{ text: answer }] },
        finishReason: "STOP",
      },
    ],
  });
};
