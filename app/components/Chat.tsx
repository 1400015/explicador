"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Subject, SUBJECT_LABELS } from "@/lib/gemini";
import { processImageFiles } from "@/lib/images";
import { takePhoto } from "@/lib/camera";
import { isSpeaking, isSpeechRecognitionAvailable, listenOnce, speak, stopSpeaking } from "@/lib/voice";
import { loadSettings, type AppSettings } from "@/lib/settings";
import Settings from "./Settings";
import {
  MAX_IMAGES_PER_MESSAGE,
  type ChatImage,
  type ChatMessage,
} from "@/lib/shared";

type StoredMessage = { role: "user" | "model"; text: string };
type StoredState = { messages: StoredMessage[]; subject: Subject };

type PendingImage = {
  id: string;
  previewUrl: string;
  image: ChatImage;
};

const STORAGE_KEY = "tutor-ia-history-v1";
const STORAGE_EVENT = "tutor-ia-storage";
const EMPTY_STATE: StoredState = { messages: [], subject: "geral" };

const SUBJECTS = Object.keys(SUBJECT_LABELS) as Subject[];

const SUBJECT_ICONS: Record<Subject, string> = {
  matematica: "➗",
  ciencias: "🔬",
  portugues: "📖",
  historia: "🏛️",
  geografia: "🌎",
  geral: "💡",
};

const GREETINGS: Record<Subject, string> = {
  matematica: "Oi! Pronto para dominar a matemática? Manda a dúvida! ➗",
  ciencias: "E aí, cientista! Qual mistério da ciência vamos desvendar hoje? 🔬",
  portugues: "Olá! Bora turbinar esse português? Me conta o que você quer estudar! 📖",
  historia: "Salve! Que página da história a gente vai explorar hoje? 🏛️",
  geografia: "Oi, explorador! Pronto para viajar pelo mundo sem sair de casa? 🌎",
  geral: "Oi! Estou aqui para te ajudar em qualquer matéria. O que vamos estudar? 💡",
};

let cache: StoredState | null = null;

function loadState(): StoredState {
  if (cache) return cache;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    cache = saved ? (JSON.parse(saved) as StoredState) : EMPTY_STATE;
  } catch {
    cache = EMPTY_STATE;
  }
  return cache;
}

function saveState(state: StoredState) {
  cache = state;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // armazenamento cheio ou indisponível: segue só em memória
  }
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(STORAGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(STORAGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): StoredState {
  return loadState();
}

function getServerSnapshot(): StoredState {
  return EMPTY_STATE;
}

export default function Chat() {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { messages: storedMessages, subject } = stored;

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    storedMessages.map((m) => ({ role: m.role, text: m.text }))
  );
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>({ mode: "server", apiKey: "", pin: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
  const speechSupported = isSpeechRecognitionAvailable();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, pendingImages]);

  useEffect(() => {
    return () => {
      pendingImages.forEach((p) => {
        if (p.previewUrl.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistMessages(next: ChatMessage[]) {
    setMessages(next);
    saveState({
      subject: loadState().subject,
      messages: next.map(({ role, text }) => ({ role, text })),
    });
  }

  function updateSubject(next: Subject) {
    saveState({ ...loadState(), subject: next });
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    if (pendingImages.length + files.length > MAX_IMAGES_PER_MESSAGE) {
      setError(`Você pode anexar no máximo ${MAX_IMAGES_PER_MESSAGE} fotos por mensagem.`);
      return;
    }

    setError(null);
    try {
      const processed = await processImageFiles(files);
      const previews = files.map((file, i) => ({
        id: `${Date.now()}-${i}`,
        previewUrl: URL.createObjectURL(file),
        image: processed[i],
      }));
      setPendingImages((prev) => [...prev, ...previews]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui processar a imagem.");
    }
  }

  async function handleListen() {
    if (listening || loading) return;
    setError(null);
    setListening(true);
    try {
      const text = await listenOnce();
      setInput((prev) => (prev ? `${prev} ${text}` : text));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui ouvir. Tenta outra vez. 🎤");
    } finally {
      setListening(false);
    }
  }

  function handleSpeak(index: number, text: string) {
    if (speakingMessageIndex === index) {
      stopSpeaking();
      setSpeakingMessageIndex(null);
      return;
    }
    setSpeakingMessageIndex(index);
    speak(text, () => setSpeakingMessageIndex(null));
  }

  async function handleTakePhoto() {
    if (loading) return;
    if (pendingImages.length >= MAX_IMAGES_PER_MESSAGE) {
      setError(`Você pode anexar no máximo ${MAX_IMAGES_PER_MESSAGE} fotos por mensagem.`);
      return;
    }
    setError(null);
    try {
      const image = await takePhoto();
      setPendingImages((prev) => [
        ...prev,
        {
          id: `camera-${Date.now()}`,
          previewUrl: `data:${image.mimeType};base64,${image.data}`,
          image,
        },
      ]);
    } catch (err) {
      if (err instanceof Error && err.message !== "Captura cancelada.") {
        setError(err.message);
      }
    }
  }

  function removePendingImage(id: string) {
    setPendingImages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target && target.previewUrl.startsWith("blob:")) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim() || (pendingImages.length > 0 ? "Olha essa foto do meu trabalho, pode me ajudar?" : "");
    if ((!text && pendingImages.length === 0) || loading) return;

    setError(null);
    setInput("");

    const images = pendingImages.map((p) => p.image);
    const newMessages: ChatMessage[] = [...messages, { role: "user", text, images }];
    persistMessages(newMessages);
    setPendingImages([]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          images,
          history: messages,
          subject,
          apiKey: settings.mode === "direct" ? settings.apiKey : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Algo deu errado. Tenta de novo?");
        persistMessages(messages);
        return;
      }

      persistMessages([...newMessages, { role: "model", text: data.reply }]);
    } catch {
      setError("Não consegui falar com o tutor agora. Verifica sua internet e tenta de novo.");
      persistMessages(messages);
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    stopSpeaking();
    setSpeakingMessageIndex(null);
    pendingImages.forEach((p) => {
      if (p.previewUrl.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
    });
    setPendingImages([]);
    persistMessages([]);
    saveState({ messages: [], subject });
    setError(null);
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-gradient-to-b from-sky-100 to-indigo-100">
      <header className="border-b border-indigo-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎓</span>
            <h1 className="text-lg font-bold text-indigo-900">Tutor IA</h1>
            {settings.mode === "direct" && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                modo app
              </span>
            )}
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            title="Definições (pais)"
            className="rounded-full bg-indigo-100 px-3 py-1 text-lg text-indigo-700 transition hover:bg-indigo-200"
          >
            ⚙️
          </button>
          <div className="flex flex-wrap items-center gap-1">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                onClick={() => updateSubject(s)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                  subject === s
                    ? "bg-indigo-600 text-white"
                    : "bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
                }`}
              >
                {SUBJECT_ICONS[s]} {SUBJECT_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !loading && (
          <div className="mt-10 text-center">
            <div className="mb-4 text-6xl">👋</div>
            <p className="text-lg font-medium text-indigo-900">{GREETINGS[subject]}</p>
            <p className="mt-2 text-sm text-indigo-700">
              Dica: você pode anexar uma foto do seu caderno ou ficha com o botão 📎!
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm ${
              m.role === "user"
                ? "self-end bg-indigo-600 text-white"
                : "self-start bg-white text-gray-800"
            }`}
          >
            {m.role === "model" && (
              <span className="mb-1 block text-xs font-semibold text-indigo-500">Tutor</span>
            )}
            {m.images && m.images.length > 0 && (
              <span className="mb-2 flex flex-wrap gap-2">
                {m.images.map((img, j) => (
                  <img
                    key={j}
                    src={`data:${img.mimeType};base64,${img.data}`}
                    alt={`Foto anexada ${j + 1}`}
                    className="max-h-40 rounded-lg border border-white/40"
                  />
                ))}
              </span>
            )}
            {m.text}
            {m.role === "model" && (
              <button
                onClick={() => handleSpeak(i, m.text)}
                title={speakingMessageIndex === i ? "Parar leitura" : "Ouvir esta resposta"}
                className={`mt-2 text-xs font-medium ${
                  speakingMessageIndex === i
                    ? "text-red-500"
                    : "text-indigo-400 hover:text-indigo-600"
                }`}
              >
                {speakingMessageIndex === i ? "⏹️ Parar" : "🔊 Ouvir"}
              </button>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex max-w-[85%] items-center gap-2 self-start rounded-2xl bg-white px-4 py-3 text-gray-500 shadow-sm">
            <span className="animate-bounce">●</span>
            <span className="animate-bounce [animation-delay:150ms]">●</span>
            <span className="animate-bounce [animation-delay:300ms]">●</span>
          </div>
        )}

        {error && (
          <div className="self-center rounded-xl bg-red-100 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      <footer className="border-t border-indigo-100 bg-white/80 backdrop-blur">
        {pendingImages.length > 0 && (
          <div className="mx-auto flex max-w-2xl flex-wrap gap-2 px-4 pt-3">
            {pendingImages.map((p) => (
              <div key={p.id} className="relative">
                <img
                  src={p.previewUrl}
                  alt="Foto para enviar"
                  className="h-20 w-20 rounded-lg border border-indigo-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePendingImage(p.id)}
                  title="Remover foto"
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <form
          onSubmit={sendMessage}
          className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={handleFilesSelected}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            title="Anexar foto da galeria"
            className="rounded-full bg-indigo-100 px-3 py-2 text-xl text-indigo-700 transition hover:bg-indigo-200 disabled:opacity-50"
          >
            📎
          </button>
          <button
            type="button"
            onClick={handleTakePhoto}
            disabled={loading}
            title="Tirar foto com a câmara"
            className="rounded-full bg-indigo-100 px-3 py-2 text-xl text-indigo-700 transition hover:bg-indigo-200 disabled:opacity-50"
          >
            📷
          </button>
          {speechSupported && (
            <button
              type="button"
              onClick={handleListen}
              disabled={loading || listening}
              title={listening ? "A ouvir... fala agora" : "Falar em vez de escrever"}
              className={`rounded-full px-3 py-2 text-xl transition disabled:opacity-50 ${
                listening
                  ? "animate-pulse bg-red-500 text-white"
                  : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
              }`}
            >
              🎤
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreve sua dúvida aqui..."
            maxLength={1000}
            disabled={loading}
            className="flex-1 rounded-full border border-indigo-200 bg-white px-4 py-2 text-[15px] text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || (!input.trim() && pendingImages.length === 0)}
            className="rounded-full bg-indigo-600 px-5 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            Enviar
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              title="Limpar conversa"
              className="rounded-full bg-gray-200 px-3 py-2 text-gray-600 transition hover:bg-gray-300"
            >
              🗑️
            </button>
          )}
        </form>
      </footer>

      {settingsOpen && (
        <Settings
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSaved={(next) => {
            setSettings(next);
            setSettingsOpen(false);
            setError(null);
          }}
        />
      )}
    </div>
  );
}
