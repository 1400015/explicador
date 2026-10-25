"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Subject, SUBJECT_LABELS } from "@/lib/gemini";
import { askTutorDirect, TutorError } from "@/lib/gemini-client";
import { processImageFiles } from "@/lib/images";
import { takePhoto } from "@/lib/camera";
import { isSpeechRecognitionAvailable, listenOnce, speak, stopSpeaking } from "@/lib/voice";
import { isNativeApp, loadSettings, type AppSettings } from "@/lib/settings";
import { upsertConversation, type StoredMessage } from "@/lib/conversations";
import { needsSupportBanner } from "@/lib/support";
import { recordQuestion } from "@/lib/stats";
import ConversationList from "./ConversationList";
import OfflineTips from "./OfflineTips";
import SupportBanner from "./SupportBanner";
import Settings from "./Settings";
import {
  MAX_IMAGES_PER_MESSAGE,
  type ChatImage,
  type ChatMessage,
} from "@/lib/shared";

type StoredState = { messages: StoredMessage[]; subject: Subject };

type PendingImage = {
  id: string;
  previewUrl: string;
  image: ChatImage;
};

const STORAGE_KEY = "tutor-ia-history-v1";
const STORAGE_EVENT = "tutor-ia-storage";
const EMPTY_STATE: StoredState = { messages: [], subject: "geral" };

function newConversationId(): string {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
  const [settings, setSettings] = useState<AppSettings>({
    mode: "server",
    apiKey: "",
    serverUrl: "",
    pin: null,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string>(newConversationId);
  const [listening, setListening] = useState(false);
  const [supportDismissed, setSupportDismissed] = useState(false);
  const [offlineTipsOpen, setOfflineTipsOpen] = useState(false);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
  const speechSupported = isSpeechRecognitionAvailable();
  const showSupportBanner =
    !supportDismissed &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "user" &&
    needsSupportBanner(messages[messages.length - 1].text);
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
    if (next.length > 0) {
      void upsertConversation({
        id: conversationId,
        subject,
        updatedAt: Date.now(),
        messages: next.map(({ role, text }) => ({ role, text })) as StoredMessage[],
      });
    }
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

  async function askTutor(
    text: string,
    images: ChatImage[],
    history: ChatMessage[]
  ): Promise<string | null> {
    const native = isNativeApp();

    if (native && settings.mode === "direct") {
      // App Android: o telemóvel fala diretamente com a Gemini (sem servidor).
      if (!settings.apiKey.trim()) {
        setError("Guarda a tua chave API nas Definições (⚙️) para a app funcionar.");
        return null;
      }
      return askTutorDirect({
        apiKey: settings.apiKey.trim(),
        message: text,
        history,
        subject,
        images,
      });
    }

    if (native && settings.mode === "server" && settings.serverUrl.trim()) {
      // App Android + servidor próprio do utilizador.
      const base = settings.serverUrl.trim().replace(/\/+$/, "");
      const res = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, images, history, subject }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "O servidor não respondeu. Confere o endereço nas Definições.");
        return null;
      }
      return data.reply as string;
    }

    if (native && settings.mode === "server") {
      // App Android sem servidor: explica em vez de ficar em branco.
      setError(
        "Esta app não tem servidor ligado. Nas Definições (⚙️), escolhe o modo “Esta app” e guarda a tua chave API — ou indica o endereço de um servidor próprio."
      );
      return null;
    }

    // Web (PWA/navegador): fala com o servidor onde a app está publicada.
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        images,
        history,
        subject,
        apiKey: settings.mode === "direct" ? settings.apiKey : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Algo deu errado. Tenta de novo?");
      return null;
    }
    return data.reply as string;
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim() || (pendingImages.length > 0 ? "Olha essa foto do meu trabalho, pode me ajudar?" : "");
    if ((!text && pendingImages.length === 0) || loading) return;

    setError(null);
    setInput("");

    const images = pendingImages.map((p) => p.image);
    void recordQuestion(subject);
    const newMessages: ChatMessage[] = [...messages, { role: "user", text, images }];
    persistMessages(newMessages);
    setPendingImages([]);
    setLoading(true);

    try {
      const reply = await askTutor(text, images, messages);
      if (reply === null) {
        persistMessages(messages);
        return;
      }
      persistMessages([...newMessages, { role: "model", text: reply }]);
    } catch (err) {
      setError(
        err instanceof TutorError
          ? err.message
          : "Não consegui falar com o tutor agora. Verifica sua internet e tenta de novo."
      );
      if (!(err instanceof TutorError)) {
        setOfflineTipsOpen(true);
      }
      persistMessages(messages);
    } finally {
      setLoading(false);
    }
  }

  async function handleExplainSimpler(index: number) {
    if (loading) return;
    const target = messages[index];
    if (!target || target.role !== "model") return;

    setError(null);
    setLoading(true);
    try {
      const question = messages
        .slice(0, index)
        .reverse()
        .find((m) => m.role === "user");
      const original = question?.text ?? "a tua última explicação";
      const request = `Não entendi a tua última resposta sobre "${original.slice(0, 200)}". Podes explicar de um jeito mais simples, com um exemplo do dia a dia e passos mais curtos?`;
      const reply = await askTutor(request, [], messages);
      if (reply === null) return;
      const next: ChatMessage[] = [
        ...messages,
        { role: "user" as const, text: request },
        { role: "model" as const, text: reply },
      ];
      persistMessages(next);
    } catch (err) {
      setError(
        err instanceof TutorError
          ? err.message
          : "Não consegui reformular agora. Tenta de novo daqui a pouco."
      );
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
    setMessages([]);
    setSupportDismissed(false);
    setConversationId(newConversationId());
    saveState({ messages: [], subject });
    setError(null);
  }

  function openConversation(conversation: {
    id: string;
    subject: Subject;
    messages: StoredMessage[];
  }) {
    stopSpeaking();
    setSpeakingMessageIndex(null);
    setPendingImages([]);
    setSupportDismissed(false);
    setConversationId(conversation.id);
    setMessages(conversation.messages.map((m) => ({ role: m.role, text: m.text })));
    saveState({ subject: conversation.subject, messages: conversation.messages });
    updateSubject(conversation.subject);
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
            <ConversationList
              onOpen={openConversation}
              onDeleted={(id) => {
                if (id === conversationId) {
                  setMessages([]);
                  setConversationId(newConversationId());
                }
              }}
            />
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
                  // eslint-disable-next-line @next/next/no-img-element -- preview base64 local, next/image não otimiza data-URLs
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
              <span className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => handleSpeak(i, m.text)}
                  title={speakingMessageIndex === i ? "Parar leitura" : "Ouvir esta resposta"}
                  className={`text-xs font-medium ${
                    speakingMessageIndex === i
                      ? "text-red-500"
                      : "text-indigo-400 hover:text-indigo-600"
                  }`}
                >
                  {speakingMessageIndex === i ? "⏹️ Parar" : "🔊 Ouvir"}
                </button>
                <button
                  onClick={() => handleExplainSimpler(i)}
                  disabled={loading}
                  title="Não entendi — explica de um jeito mais simples"
                  className="text-xs font-medium text-indigo-400 transition hover:text-indigo-600 disabled:opacity-50"
                >
                  🤔 Não entendi
                </button>
              </span>
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

        {showSupportBanner && <SupportBanner onClose={() => setSupportDismissed(true)} />}

        {offlineTipsOpen && !loading && (
          <OfflineTips subject={subject} onClose={() => setOfflineTipsOpen(false)} />
        )}

        <div ref={bottomRef} />
      </main>

      <footer className="border-t border-indigo-100 bg-white/80 backdrop-blur">
        {pendingImages.length > 0 && (
          <div className="mx-auto flex max-w-2xl flex-wrap gap-2 px-4 pt-3">
            {pendingImages.map((p) => (
              <div key={p.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- preview local (blob/data URL) temporário, next/image não otimiza */}
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
