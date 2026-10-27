import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3176",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  webServer: [
    {
      command:
        "node --require ./tests/fixtures/gemini.cjs node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3176",
      url: "http://127.0.0.1:3176",
      reuseExistingServer: false,
      env: {
        GEMINI_API_KEY: "AIza" + "A".repeat(35),
        NEXT_TELEMETRY_DISABLED: "1",
      },
      timeout: 30_000,
    },
    {
      command: "node tests/fixtures/pwa-server.mjs",
      url: "http://127.0.0.1:3177/__status",
      reuseExistingServer: false,
      timeout: 15_000,
    },
  ],
});
