import { createHash } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";

const key = "tutor-ia-conversations-v2";
const input = (page: Page) =>
  page.getByRole("textbox", { name: "A tua pergunta" });
const send = async (page: Page, text: string) => {
  await input(page).fill(text);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
};
const gate = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { resolve, promise };
};
async function seed(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "yes");
    const messages = [
      { role: "user", text: "Pergunta que estava guardada" },
      { role: "model", text: "Resposta que estava guardada" },
    ];
    localStorage.setItem(
      "tutor-ia-history-v1",
      JSON.stringify({ subject: "matematica", messages }),
    );
    localStorage.setItem(
      "tutor-ia-conversations-v1",
      JSON.stringify([
        { id: "original", subject: "matematica", updatedAt: 1, messages },
      ]),
    );
  });
}

test("chat real pela API compilada, sem erros de hidratação", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await send(page, "Como funcionam as frações?");
  await expect(
    page.getByText("Explicação simulada segura.", { exact: false }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("migração recupera disciplina e ID; limpar após reload apaga também o arquivo", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/");
  await expect(
    page.getByText("Pergunta que estava guardada", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).activeId,
        key,
      ),
    )
    .toBe("original");
  await page.reload();
  await page
    .getByRole("button", { name: "Limpar conversa", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).conversations.length,
        key,
      ),
    )
    .toBe(0);
  await page.reload();
  await expect(
    page.getByText("Pergunta que estava guardada", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("tutor-ia-history-v1")),
  ).toBeNull();
});

for (const outcome of ["success", "error"]) {
  test(
    "resposta antiga " +
      outcome +
      " não altera conversa nova, incluindo finally",
    async ({ page }) => {
      // Simula também transportes que não respeitam AbortSignal (HTTP nativo).
      await page.addInitScript(() => {
        const fetchOriginal = window.fetch;
        window.fetch = (url, init) =>
          fetchOriginal(
            url,
            typeof url === "string" && url.includes("/api/chat")
              ? { ...init, signal: undefined }
              : init,
          );
      });
      const old = gate(),
        next = gate();
      let calls = 0;
      await page.route("**/api/chat", async (route) => {
        const count = ++calls;
        if (count === 1) {
          await old.promise;
          await route.fulfill({
            status: outcome === "error" ? 503 : 200,
            json:
              outcome === "error"
                ? { error: "ERRO_ANTIGO" }
                : { reply: "RESPOSTA_ANTIGA" },
          });
        } else {
          await next.promise;
          await route.fulfill({ json: { reply: "RESPOSTA_NOVA" } });
        }
      });
      await page.goto("/");
      await send(page, "Pergunta antiga");
      await expect.poll(() => calls).toBe(1);
      await page
        .getByRole("button", { name: "Limpar conversa", exact: true })
        .click();
      await send(page, "Pergunta nova");
      await expect.poll(() => calls).toBe(2);
      old.resolve();
      await expect(
        page.getByRole("status", {
          name: "O tutor está a preparar a resposta",
        }),
      ).toBeVisible();
      await expect(input(page)).toBeDisabled();
      next.resolve();
      await expect(
        page.getByText("RESPOSTA_NOVA", { exact: false }),
      ).toBeVisible();
      await expect(
        page.getByText(/RESPOSTA_ANTIGA|ERRO_ANTIGO|Pergunta antiga/),
      ).toHaveCount(0);
      const saved = await page.evaluate(
        (key) => localStorage.getItem(key),
        key,
      );
      expect(saved).not.toContain("ANTIGA");
      expect(saved).not.toContain("Pergunta antiga");
    },
  );
}

test("limpar durante Não entendi não repõe a conversa", async ({ page }) => {
  await seed(page);
  const wait = gate();
  let requested = false;
  await page.route("**/api/chat", async (route) => {
    requested = true;
    await wait.promise;
    await route
      .fulfill({ json: { reply: "REFORMULACAO_ANTIGA" } })
      .catch(() => {});
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Não entendi/ }).click();
  await expect.poll(() => requested).toBe(true);
  await page
    .getByRole("button", { name: "Limpar conversa", exact: true })
    .click();
  wait.resolve();
  await expect(
    page.getByRole("status", { name: "O tutor está a preparar a resposta" }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).conversations.length,
        key,
      ),
    )
    .toBe(0);
  await expect(page.getByText(/REFORMULACAO_ANTIGA/)).toHaveCount(0);
});
test("falha de envio conserva rascunho e fotografia", async ({ page }) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({ status: 503, json: { error: "Tenta novamente" } }),
  );
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .setInputFiles("public/icons/icon-192.png");
  await expect(
    page.getByAltText("Foto para enviar", { exact: true }),
  ).toBeVisible();
  await send(page, "Dúvida com fotografia");
  await expect(input(page)).toHaveValue("Dúvida com fotografia");
  await expect(
    page.getByAltText("Foto para enviar", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), key),
  ).not.toContain("Dúvida com fotografia");
});
test("banner de apoio permanece depois da resposta e reativa após novo pedido de ajuda", async ({
  page,
}) => {
  await page.goto("/");
  await send(page, "quero me machucar");
  const banner = page
    .locator('main [role="alert"]')
    .filter({ hasText: "não tens de passar" });
  await expect(
    page.getByText("Explicação simulada segura.", { exact: false }),
  ).toBeVisible();
  await expect(banner).toBeVisible();
  await page.getByRole("button", { name: "Fechar contactos de apoio" }).click();
  await expect(banner).toHaveCount(0);
  await send(page, "sinto-me sozinho");
  await expect(banner).toBeVisible();
});
test("eliminação sincroniza com outro separador", async ({ context, page }) => {
  await seed(page);
  await page.goto("/");
  await expect(
    page.getByText("Pergunta que estava guardada", { exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto("/");
  await expect(
    other.getByText("Pergunta que estava guardada", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Limpar conversa", exact: true })
    .click();
  await expect(
    other.getByText("Pergunta que estava guardada", { exact: true }),
  ).toHaveCount(0);
});

for (const width of [320, 360, 390]) {
  test(
    "ecrã " + width + "px permite enviar, anexar e limpar sem transbordo",
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 740 });
      await page.goto("/");
      await page
        .locator('input[type="file"]')
        .setInputFiles("public/icons/icon-192.png");
      await expect(
        page.getByAltText("Foto para enviar", { exact: true }),
      ).toBeVisible();
      await send(page, "Dúvida com foto");
      await expect(
        page.getByText("Explicação simulada segura.", { exact: false }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const name of [
        "Enviar",
        "Anexar foto da galeria",
        "Limpar conversa",
      ]) {
        const rect = await page
          .getByRole("button", { name, exact: true })
          .boundingBox();
        expect(rect!.x).toBeGreaterThanOrEqual(0);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
      }
      expect(errors).toEqual([]);
      if (width === 390)
        await page.screenshot({
          path: test.info().outputPath("mobile-390.png"),
        });
    },
  );
}
test("ausência de reconhecimento de voz não causa hidratação incorreta", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "SpeechRecognition");
    Reflect.deleteProperty(window, "webkitSpeechRecognition");
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await send(page, "Como estudo matemática?");
  await expect(
    page.getByText("Explicação simulada segura.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ditar pergunta" }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("definições têm foco contido, campos nomeados e Escape devolve foco", async ({
  page,
}) => {
  await page.goto("/");
  const settings = page.getByRole("button", { name: "Definições (pais)" });
  await settings.click();
  const dialog = page.getByRole("dialog", { name: "Definições dos pais" });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(settings).toBeFocused();
});

test("modal bloqueado conserva foco depois de desbloquear com o PIN existente", async ({
  page,
}) => {
  const hash = createHash("sha256").update("test-salt:4321").digest("hex");
  await page.addInitScript(
    (value) =>
      localStorage.setItem(
        "tutor-ia-settings-v1",
        JSON.stringify({
          mode: "server",
          apiKey: "",
          serverUrl: "",
          pin: { salt: "test-salt", hash: value },
        }),
      ),
    hash,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Definições (pais)" }).click();
  const locked = page.getByRole("dialog", { name: "Definições bloqueadas" });
  await expect(locked).toBeVisible();
  await locked.getByLabel("PIN", { exact: true }).fill("4321");
  await locked.getByRole("button", { name: "Desbloquear" }).click();
  const dialog = page.getByRole("dialog", { name: "Definições dos pais" });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      dialog.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("envio aguarda processamento da fotografia sem perder o anexo", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () {
      await new Promise<void>((resolve) => {
        Object.assign(window, { releasePhoto: resolve });
      });
      return decode.call(this);
    };
  });
  await page.goto("/");
  await input(page).fill("Pergunta antes de a fotografia estar pronta");
  await page
    .locator('input[type="file"]')
    .setInputFiles("public/icons/icon-192.png");
  await expect(
    page.getByText("A preparar a fotografia…", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Anexar foto da galeria" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Tirar foto com a câmara" }),
  ).toBeDisabled();
  await page.evaluate(() =>
    (window as unknown as { releasePhoto: () => void }).releasePhoto(),
  );
  await expect(
    page.getByAltText("Foto para enviar", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeEnabled();
});

test("modo Esta app usa Google no teste e no chat sem enviar a chave ao backend", async ({
  page,
}) => {
  const key = "AIza" + "A".repeat(35);
  let backend = 0,
    google = 0;
  await page.route("**/api/chat", (route) => {
    backend++;
    return route.fulfill({ status: 500, json: { error: "Wrong route" } });
  });
  await page.route(
    "https://generativelanguage.googleapis.com/**",
    async (route) => {
      if (route.request().method() === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
          },
        });
      google++;
      const json = route.request().postDataJSON();
      const text = JSON.stringify(json.contents);
      await route.fulfill({
        headers: { "Access-Control-Allow-Origin": "*" },
        json: {
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: text.includes("Avalia se o texto")
                      ? "SIM"
                      : "Resposta direta da Google",
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        },
      });
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Definições (pais)" }).click();
  await page.getByRole("button", { name: /Esta app/ }).click();
  await page.getByLabel("Chave API do Google Gemini").fill(key);
  await page.getByRole("button", { name: "Testar chave", exact: true }).click();
  await expect(page.getByText("Ligação OK!", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await send(page, "Como estudo frações?");
  await expect(
    page.getByText("Resposta direta da Google", { exact: false }),
  ).toBeVisible();
  expect(google).toBe(4);
  expect(backend).toBe(0);
  expect(
    await page.evaluate(() => localStorage.getItem("tutor-ia-settings-v1")),
  ).not.toContain(key);
  expect(
    await page.evaluate(() => localStorage.getItem("tutor-ia-api-key-v2")),
  ).toBeNull();
  expect(
    await page.evaluate(() => sessionStorage.getItem("tutor-ia-api-key-v2")),
  ).toBe(key);
});
test("atraso de PIN persiste após fechar e reabrir definições", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Date.now = () => 1000;
  });
  const hash = createHash("sha256").update("test-salt:4321").digest("hex");
  await page.addInitScript(
    (value) =>
      localStorage.setItem(
        "tutor-ia-settings-v1",
        JSON.stringify({
          mode: "server",
          apiKey: "",
          serverUrl: "",
          pin: { salt: "test-salt", hash: value },
        }),
      ),
    hash,
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Definições (pais)" }).click();
  const dialog = page.getByRole("dialog", { name: "Definições bloqueadas" });
  for (let i = 0; i < 3; i++) {
    await dialog.getByLabel("PIN", { exact: true }).fill("1111");
    await dialog.getByRole("button", { name: "Desbloquear" }).click();
    await expect(
      dialog.getByText("PIN incorreto.", { exact: false }),
    ).toBeVisible();
    await expect(dialog.getByLabel("PIN", { exact: true })).toHaveValue("");
  }
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Definições (pais)" }).click();
  await dialog.getByLabel("PIN", { exact: true }).fill("4321");
  await dialog.getByRole("button", { name: "Desbloquear" }).click();
  await expect(dialog.getByText("Aguarda", { exact: false })).toBeVisible();
});

test("criar PIN noutra janela fecha definições abertas e exige o PIN novo", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  await other.getByRole("button", { name: "Definições (pais)" }).click();
  await expect(
    other.getByRole("dialog", { name: "Definições dos pais" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Definições (pais)" }).click();
  await page.getByRole("button", { name: "🔐 Criar PIN de proteção" }).click();
  await page.getByLabel("Novo PIN", { exact: true }).fill("4321");
  await page.getByLabel("Repetir novo PIN", { exact: true }).fill("4321");
  await page.getByRole("button", { name: "Criar PIN", exact: true }).click();
  await expect(other.getByRole("dialog")).toHaveCount(0);
  await other.getByRole("button", { name: "Definições (pais)" }).click();
  const locked = other.getByRole("dialog", { name: "Definições bloqueadas" });
  await expect(locked).toBeVisible();
  await locked.getByLabel("PIN", { exact: true }).fill("4321");
  await locked.getByRole("button", { name: "Desbloquear" }).click();
  await expect(
    other.getByRole("dialog", { name: "Definições dos pais" }),
  ).toBeVisible();
});

test("apagar chave interrompe a resposta pendente e conserva a pergunta para repetir", async ({
  page,
}) => {
  const key = "AIza" + "A".repeat(35),
    waiting = gate();
  let requested = false;
  await page.route(
    "https://generativelanguage.googleapis.com/**",
    async (route) => {
      if (route.request().method() === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
          },
        });
      requested = true;
      await waiting.promise;
      await route
        .fulfill({
          headers: { "Access-Control-Allow-Origin": "*" },
          json: {
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [{ text: "RESPOSTA_COM_CHAVE_APAGADA" }],
                },
                finishReason: "STOP",
              },
            ],
          },
        })
        .catch(() => {});
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Definições (pais)" }).click();
  await page.getByRole("button", { name: /Esta app/ }).click();
  await page.getByLabel("Chave API do Google Gemini").fill(key);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await send(page, "Pergunta a conservar depois de apagar a chave");
  await expect.poll(() => requested).toBe(true);
  await page.getByRole("button", { name: "Definições (pais)" }).click();
  await page.getByRole("button", { name: "Apagar chave", exact: true }).click();
  await expect(input(page)).toHaveValue(
    "Pergunta a conservar depois de apagar a chave",
  );
  await expect(input(page)).toBeEnabled();
  waiting.resolve();
  await expect(
    page.getByText("RESPOSTA_COM_CHAVE_APAGADA", { exact: false }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => sessionStorage.getItem("tutor-ia-api-key-v2")),
  ).toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem("tutor-ia-api-key-v2")),
  ).toBeNull();
});
