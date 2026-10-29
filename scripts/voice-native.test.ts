import { test } from "node:test";
import assert from "node:assert/strict";

test("a leitura Android usa a voz nativa, a variante escolhida e comunica erros", async () => {
  const calls: Array<{ method: string; options: Record<string, unknown> }> = [];
  let fail = false;
  let hold = false;
  let release: (() => void) | undefined;
  Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
  Object.assign(globalThis, {
    androidBridge: {},
    Capacitor: {
      PluginHeaders: [{
        name: "TextToSpeech",
        methods: [{ name: "speak", rtype: "promise" }, { name: "stop", rtype: "promise" }],
      }],
      nativePromise: (_plugin: string, method: string, options: Record<string, unknown>) => {
        calls.push({ method, options });
        if (method === "speak" && fail) return Promise.reject(new Error("engine unavailable"));
        if (method === "speak" && hold) return new Promise<void>((resolve) => { release = resolve; });
        return Promise.resolve();
      },
    },
  });

  const { speak, stopSpeaking, isSpeaking } = await import("../lib/voice");
  const text = "Uma resposta longa para o aluno. ".repeat(180);
  await new Promise<void>((resolve, reject) => speak(text, resolve, "pt-PT", reject));
  const readCalls = calls.filter((call) => call.method === "speak");
  assert.ok(readCalls.length > 1);
  assert.ok(readCalls.every((call) => call.options.lang === "pt-PT"));
  assert.ok(readCalls.every((call) => String(call.options.text).length <= 3000));
  assert.equal(readCalls.map((call) => String(call.options.text)).join(" ").replace(/\s+/g, " ").trim(), text.replace(/\s+/g, " ").trim());
  assert.equal(isSpeaking(), false);

  fail = true;
  let error = "";
  await new Promise<void>((resolve) => speak("Texto", resolve, "pt-BR", (message) => { error = message; }));
  assert.match(error, /voz em português/);
  assert.equal(isSpeaking(), false);

  fail = false;
  hold = true;
  let oldEnded = false;
  speak("Leitura interrompida", () => { oldEnded = true; }, "pt-PT");
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  stopSpeaking();
  hold = false;
  await new Promise<void>((resolve, reject) => speak("Nova leitura", resolve, "pt-PT", reject));
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(oldEnded, false);
  assert.ok(calls.some((call) => call.method === "stop"));
  assert.equal(isSpeaking(), false);
});
