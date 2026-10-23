"use client";

import { SpeechRecognition } from "@capacitor-community/speech-recognition";

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
  return typeof window !== "undefined" &&
    // @ts-expect-error Capacitor injeta este objeto na app nativa
    !!window.Capacitor?.isNativePlatform?.();
}

function getWebSpeechRecognition(): WebSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition) as WebSpeechRecognitionConstructor | null;
}

export function isSpeechRecognitionAvailable(): boolean {
  if (isCapacitorNative()) return true;
  return getWebSpeechRecognition() !== null;
}

/**
 * Ouve o utilizador e devolve o texto reconhecido (pt-BR).
 * Na app Android usa o reconhecimento nativo; no browser usa a Web Speech API.
 */
export async function listenOnce(): Promise<string> {
  if (isCapacitorNative()) {
    const available = await SpeechRecognition.available();
    if (!available.available) {
      throw new Error("O reconhecimento de voz não está disponível neste telemóvel.");
    }
    const permission = await SpeechRecognition.checkPermissions();
    if (permission.speechRecognition !== "granted") {
      const requested = await SpeechRecognition.requestPermissions();
      if (requested.speechRecognition !== "granted") {
        throw new Error("Preciso de acesso ao microfone para te ouvir. Aceita a permissão.");
      }
    }
    const result = await SpeechRecognition.start({
      language: "pt-BR",
      partialResults: false,
      popup: false,
    });
    const text = result.matches?.[0];
    if (!text) throw new Error("Não consegui perceber. Fala mais perto do telemóvel.");
    return text;
  }

  const SR = getWebSpeechRecognition();
  if (!SR) {
    throw new Error("O teu browser não suporta reconhecimento de voz.");
  }
  return new Promise((resolve, reject) => {
    const recognition = new SR();
    recognition.lang = "pt-BR";
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
        reject(new Error("Preciso de acesso ao microfone. Aceita a permissão. 🎤"));
      } else {
        reject(new Error("Deu erro ao ouvir. Tenta outra vez. 🎤"));
      }
    };
    recognition.start();
  });
}

let speaking = false;

export function isSpeaking(): boolean {
  return speaking;
}

/** Lê um texto em voz alta (pt-BR). Usa a voz do próprio sistema. */
export function speak(text: string, onEnd?: () => void): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  utterance.rate = 1;
  utterance.pitch = 1;
  speaking = true;
  utterance.onend = () => {
    speaking = false;
    onEnd?.();
  };
  utterance.onerror = () => {
    speaking = false;
    onEnd?.();
  };
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  speaking = false;
}
