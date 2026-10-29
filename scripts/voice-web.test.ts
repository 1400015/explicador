import { test } from "node:test";
import assert from "node:assert/strict";
import { speak, stopSpeaking, isSpeaking } from "../lib/voice";

test("leitura web informa quando não há motor disponível", () => {
  let error = "";
  let ended = false;
  speak("Olá", () => { ended = true; }, "pt-PT", (message) => { error = message; });
  assert.match(error, /navegador/);
  assert.equal(ended, true);
  assert.equal(isSpeaking(), false);
});

test("a leitura web usa a variante escolhida e ignora eventos de leituras anteriores", (t) => {
  type FakeUtterance = { lang: string; voice: unknown; onend: (() => void) | null; onerror: (() => void) | null };
  const utterances: FakeUtterance[] = [];
  let cancels = 0;
  const ptVoice = { lang: "pt-PT" };
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    speechSynthesis: {
      cancel: () => { cancels++; },
      getVoices: () => [ptVoice],
      speak: (utterance: FakeUtterance) => { utterances.push(utterance); },
    },
  }});
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { configurable: true, value: class {
    lang = "";
    voice: unknown;
    rate = 1;
    pitch = 1;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
  }});
  t.after(() => { stopSpeaking(); Reflect.deleteProperty(globalThis, "window"); Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance"); });

  let staleEnd = false;
  let errors = 0;
  let finished = false;
  speak("Primeira", () => { staleEnd = true; }, "pt-PT", () => { errors++; });
  speak("Segunda", () => { finished = true; }, "pt-PT", () => { errors++; });
  assert.equal(utterances[1].lang, "pt-PT");
  assert.equal(utterances[1].voice, ptVoice);
  utterances[0].onerror?.();
  assert.equal(isSpeaking(), true);
  assert.equal(staleEnd, false);
  assert.equal(errors, 0);
  utterances[1].onend?.();
  assert.equal(finished, true);
  assert.equal(isSpeaking(), false);
  assert.ok(cancels >= 2);
});
