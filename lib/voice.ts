"use client";

import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import type { TutorLocale } from "./learning-profile";

// Tipos mínimos da Web Speech API (não incluídos no lib.dom do TypeScript)
type WebSpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type WebSpeechRecognitionErrorEvent = {
  error: string;
};

type WebSpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: ((event: WebSpeechRecognitionErrorEvent) => void) | null;
  start: () => void;
};

type WebSpeechRecognitionConstructor = new () => WebSpeechRecognitionInstance;

function isCapacitorNative(): boolean {
  return (
    typeof window !== "undefined" &&
    // @ts-expect-error Capacitor injeta este objeto na app nativa
    !!window.Capacitor?.isNativePlatform?.()
  );
}

function getWebSpeechRecognition(): WebSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ||
    w.webkitSpeechRecognition ||
    null) as WebSpeechRecognitionConstructor | null;
}

export function isSpeechRecognitionAvailable(): boolean {
  if (isCapacitorNative()) return true;
  return getWebSpeechRecognition() !== null;
}

/**
 * Ouve o utilizador na variante escolhida no perfil.
 * Na app Android usa o reconhecimento nativo; no browser usa a Web Speech API.
 */
export async function listenOnce(
  locale: TutorLocale = "pt-BR",
): Promise<string> {
  if (isCapacitorNative()) {
    const available = await SpeechRecognition.available();
    if (!available.available) {
      throw new Error(
        "O reconhecimento de voz não está disponível neste telemóvel.",
      );
    }
    const permission = await SpeechRecognition.checkPermissions();
    if (permission.speechRecognition !== "granted") {
      const requested = await SpeechRecognition.requestPermissions();
      if (requested.speechRecognition !== "granted") {
        throw new Error(
          "Preciso de acesso ao microfone para te ouvir. Aceita a permissão.",
        );
      }
    }
    const result = await SpeechRecognition.start({
      language: locale,
      partialResults: false,
      popup: false,
    });
    const text = result.matches?.[0];
    if (!text)
      throw new Error("Não consegui perceber. Fala mais perto do telemóvel.");
    return text;
  }

  const SR = getWebSpeechRecognition();
  if (!SR) {
    throw new Error("O teu browser não suporta reconhecimento de voz.");
  }
  return new Promise((resolve, reject) => {
    const recognition = new SR();
    recognition.lang = locale;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript;
      if (text) resolve(text);
      else reject(new Error("Não consegui perceber. Tenta outra vez."));
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        reject(new Error("Não ouvi nada. Tenta outra vez. 🎤"));
      } else if (event.error === "not-allowed") {
        reject(
          new Error("Preciso de acesso ao microfone. Aceita a permissão. 🎤"),
        );
      } else {
        reject(new Error("Deu erro ao ouvir. Tenta outra vez. 🎤"));
      }
    };
    recognition.start();
  });
}

let speaking = false;
let speechGeneration = 0;
let nativeControl = Promise.resolve();

const NATIVE_SPEECH_ERROR =
  "Não consegui ler em voz alta. Verifica o volume e se tens uma voz em português instalada nas definições de texto para voz do telemóvel.";
const WEB_SPEECH_ERROR =
  "Não consegui ler em voz alta. Verifica o volume e as definições de voz do navegador.";

// O motor de voz Android limita o comprimento de cada pedido. Conserva o texto,
// preferindo uma pausa entre palavras e sem separar pares de caracteres Unicode.
function speechChunks(text: string): string[] {
  const limit = 3000;
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > limit) {
    let end = rest.lastIndexOf(" ", limit);
    if (end < limit / 2) end = limit;
    const code = rest.charCodeAt(end - 1);
    if (code >= 0xd800 && code <= 0xdbff) end--;
    chunks.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export function isSpeaking(): boolean {
  return speaking;
}

/** Lê na variante escolhida, usando uma voz instalada no sistema. */
export function speak(
  text: string,
  onEnd?: () => void,
  locale: TutorLocale = "pt-BR",
  onError?: (message: string) => void,
): void {
  const generation = ++speechGeneration;
  speaking = true;
  let finished = false;
  const finish = (error?: string) => {
    if (finished || generation !== speechGeneration) return;
    finished = true;
    speaking = false;
    if (error) onError?.(error);
    onEnd?.();
  };

  if (isCapacitorNative()) {
    // O plugin é carregado apenas no cliente: o seu módulo acede a window.
    void (async () => {
      try {
        const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
        await nativeControl;
        for (const chunk of speechChunks(text)) {
          if (generation !== speechGeneration) return;
          await TextToSpeech.speak({ text: chunk, lang: locale });
        }
        finish();
      } catch {
        finish(NATIVE_SPEECH_ERROR);
      }
    })();
    return;
  }

  if (typeof window === "undefined" || !window.speechSynthesis) {
    finish(WEB_SPEECH_ERROR);
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    const voice = window.speechSynthesis
      .getVoices()
      .find((item) => item.lang.toLowerCase() === locale.toLowerCase());
    if (voice) utterance.voice = voice;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => finish();
    utterance.onerror = () => finish(WEB_SPEECH_ERROR);
    window.speechSynthesis.speak(utterance);
  } catch {
    finish(WEB_SPEECH_ERROR);
  }
}

export function stopSpeaking(): void {
  const wasSpeaking = speaking;
  ++speechGeneration;
  speaking = false;
  if (isCapacitorNative() && wasSpeaking) {
    // Serializa o stop com um eventual novo pedido para que uma paragem
    // anterior não interrompa a leitura que acabou de ser iniciada.
    nativeControl = nativeControl
      .then(async () => {
        const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
        await TextToSpeech.stop();
      })
      .catch(() => {});
  } else if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
