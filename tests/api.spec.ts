import { test, expect } from "@playwright/test";

test("chat no servidor compilado com histórico vazio e preenchido", async ({
  request,
}) => {
  for (const history of [
    [],
    [
      { role: "user", text: "O que é uma fração?" },
      { role: "model", text: "É uma parte do todo." },
    ],
  ]) {
    const response = await request.post("/api/chat", {
      headers: { "x-forwarded-for": crypto.randomUUID() },
      data: {
        message: "Podes dar um exemplo?",
        history,
        subject: "matematica",
      },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      reply: "Explicação simulada segura.",
    });
  }
});

test("contrato HTTP rejeita JSON e campos inválidos antes de contactar o modelo", async ({
  request,
}) => {
  for (const body of [
    "null",
    "[]",
    "{",
    JSON.stringify({ message: "x".repeat(1001) }),
    JSON.stringify({ message: "oi", history: [null] }),
    JSON.stringify({
      message: "oi",
      images: [{ mimeType: "text/html", data: "AAAA" }],
    }),
  ]) {
    const response = await request.post("/api/chat", {
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": crypto.randomUUID(),
      },
      data: body,
    });
    expect(response.status()).toBe(400);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect((await response.json()).error).toEqual(expect.any(String));
  }
});
test("texto não aprovado não aparece na resposta HTTP", async ({ request }) => {
  const response = await request.post("/api/chat", {
    headers: { "x-forwarded-for": crypto.randomUUID() },
    data: { message: "simular indisponibilidade", history: [] },
  });
  expect(response.status()).toBe(503);
  const body = await response.text();
  expect(body).toContain("verificar");
  expect(body).not.toContain("SEM_APROVACAO");
});
test("moderação avalia também o fim da resposta, depois de 2000 caracteres", async ({
  request,
}) => {
  const response = await request.post("/api/chat", {
    headers: { "x-forwarded-for": crypto.randomUUID() },
    data: { message: "simular texto longo", history: [] },
  });
  expect(response.status()).toBe(200);
  expect((await response.json()).reply).toContain("Vamos tentar outra coisa");
});
test("o limite de pedidos continua ativo", async ({ request }) => {
  const headers = { "x-forwarded-for": crypto.randomUUID() };
  for (let i = 0; i < 20; i++)
    await request.post("/api/chat", { headers, data: null });
  expect(
    (await request.post("/api/chat", { headers, data: null })).status(),
  ).toBe(429);
});

test("servidor recusa chave local de cliente antigo quando compatibilidade não está ativa", async ({
  request,
}) => {
  const response = await request.post("/api/chat", {
    headers: { "x-forwarded-for": crypto.randomUUID() },
    data: { message: "oi", history: [], apiKey: "AIza" + "A".repeat(35) },
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toContain("Atualiza a aplicação");
});
