import { test, expect } from "@playwright/test";
test.use({ serviceWorkers: "allow" });

async function ready(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

test("PWA permanece interativa offline sem depender da cache HTTP", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await ready(page);
  const protocol = await context.newCDPSession(page);
  await protocol.send("Network.clearBrowserCache");
  await context.setOffline(true);
  await page.reload();
  const input = page.getByRole("textbox", { name: "A tua pergunta" });
  await input.fill("Como se somam frações?");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(input).toHaveValue("Como se somam frações?");
  await expect(
    page.getByText("Parece que estás sem internet!", { exact: false }),
  ).toBeVisible();
  await input.fill("2+2=4");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("✅ Conta certa!", { exact: false }),
  ).toBeVisible();
  const urls = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (
      await Promise.all(
        keys.map(async (key) =>
          (await (await caches.open(key)).keys()).map((request) => request.url),
        ),
      )
    ).flat();
  });
  expect(urls.some((url) => url.endsWith(".js"))).toBe(true);
  expect(urls.some((url) => url.includes("/api/chat"))).toBe(false);
});
test("atualização conserva rascunho e dados e instalação incompleta mantém versão utilizável", async ({
  page,
  context,
  request,
}) => {
  const origin = "http://127.0.0.1:3177";
  await request.post(origin + "/__version", {
    data: { version: "A", broken: false },
  });
  await page.goto(origin);
  await ready(page);
  const input = page.getByRole("textbox", { name: "A tua pergunta" });
  await input.fill("2+2=4");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("✅ Conta certa!", { exact: false }),
  ).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles("public/icons/icon-192.png");
  await expect(
    page.getByAltText("Foto para enviar", { exact: true }),
  ).toBeVisible();
  await request.post(origin + "/__version", {
    data: { version: "B", broken: false },
  });
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  const update = page.getByRole("button", { name: "Atualizar", exact: true });
  await expect(update).toBeVisible();
  await expect(update).toBeDisabled();
  await page.getByRole("button", { name: "Remover foto", exact: true }).click();
  await input.fill("Pergunta que deve sobreviver à atualização");
  await expect(update).toBeEnabled();
  const other = await context.newPage();
  await other.goto(origin);
  await update.click();
  await expect(
    page.getByText("Fecha as outras janelas", { exact: false }),
  ).toBeVisible();
  await other.close();
  await expect(update).toBeEnabled();
  await update.click();
  await expect(input).toHaveValue("Pergunta que deve sobreviver à atualização");
  await expect(
    page.getByText("✅ Conta certa!", { exact: false }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(async () => await caches.keys()))
    .toEqual(["tutor-ia-precache-fixture-B"]);
  const root = await page.evaluate(
    async () =>
      await (await (
        await caches.open("tutor-ia-precache-fixture-B")
      ).match("/"))!.text(),
  );
  expect(root).toContain("VERSION_B");

  await request.post(origin + "/__version", {
    data: { version: "C", broken: true },
  });
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await expect
    .poll(
      async () =>
        (await (await request.get(origin + "/__status")).json()).failed,
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(async () => await caches.keys()))
    .toEqual(["tutor-ia-precache-fixture-B"]);
  const protocol = await context.newCDPSession(page);
  await protocol.send("Network.clearBrowserCache");
  await context.setOffline(true);
  await page.reload();
  await expect(input).toHaveValue("Pergunta que deve sobreviver à atualização");
  await expect(
    page.getByText("✅ Conta certa!", { exact: false }),
  ).toBeVisible();
});
