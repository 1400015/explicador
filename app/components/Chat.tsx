"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type Subject, SUBJECT_LABELS } from "@/lib/prompt";
import { learningProfile, profileDescription } from "@/lib/learning-profile";
import { LocaleContext, copyFor } from "@/lib/locale";
import type { PhotoContext } from "@/lib/photo-context";
import { TutorError } from "@/lib/tutor-error";
import { askTutor as requestTutor } from "@/lib/tutor-transport";
import { processImageFiles } from "@/lib/images";
import { takePhoto } from "@/lib/camera";
import {
  isSpeechRecognitionAvailable,
  listenOnce,
  speak,
  stopSpeaking,
} from "@/lib/voice";
import {
  loadSettings,
  reloadSettings,
  SETTINGS_KEY,
  type AppSettings,
  DEFAULT_SETTINGS,
} from "@/lib/settings";
import {
  conversationStore,
  useConversations,
  type Conversation,
} from "@/lib/conversations";
import { needsSupportBanner } from "@/lib/support";
import { RequestGuard } from "@/lib/request-guard";
import { recordQuestion } from "@/lib/stats";
import { calcFeedback, checkCalculation } from "@/lib/calc-check";
import ConversationList from "./ConversationList";
import OfflineTips from "./OfflineTips";
import SupportBanner from "./SupportBanner";
import Settings from "./Settings";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import { useDraft, saveDraft, updateDraft } from "@/lib/draft";
import { blockUpdate } from "@/lib/update-state";
import {
  MAX_IMAGES_PER_MESSAGE,
  type ChatImage,
  type ChatMessage,
} from "@/lib/shared";

type PendingImage = { id: string; previewUrl: string; image: ChatImage };
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
  ciencias:
    "E aí, cientista! Qual mistério da ciência vamos desvendar hoje? 🔬",
  portugues:
    "Olá! Bora turbinar esse português? Me conta o que você quer estudar! 📖",
  historia: "Salve! Que página da história a gente vai explorar hoje? 🏛️",
  geografia:
    "Oi, explorador! Pronto para viajar pelo mundo sem sair de casa? 🌎",
  geral:
    "Oi! Estou aqui para te ajudar em qualquer matéria. O que vamos estudar? 💡",
};
const GREETINGS_PT: Record<Subject, string> = {
  matematica: "Olá! Vamos perceber a matemática, um passo de cada vez? ➗",
  ciencias: "Olá! Que pergunta de Ciências vamos explorar hoje? 🔬",
  portugues: "Olá! Diz-me o que queres estudar em Português. 📖",
  historia: "Olá! Que tema de História vamos descobrir hoje? 🏛️",
  geografia: "Olá! Vamos explorar o mundo? Qual é a tua dúvida? 🌎",
  geral: "Olá! Estou aqui para te ajudar nos estudos. Por onde começamos? 💡",
};
const noSubscription = () => () => {};
const noSpeechOnServer = () => false;

export default function Chat() {
  const stored = useConversations();
  const { subject } = stored;
  const active = stored.conversations.find((c) => c.id === stored.activeId);
  const messages = active?.messages ?? [];
  const [pendingUser, setPendingUser] = useState<ChatMessage | null>(null);
  const displayMessages = pendingUser ? [...messages, pendingUser] : messages;
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const pendingRef = useRef(pendingImages);
  const draft = useDraft();
  const input = draft.id === stored.activeId ? draft.text : "";
  function setInput(value: string | ((previous: string) => string)) {
    updateDraft(conversationStore.getSnapshot().activeId, value);
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const profile = learningProfile(settings.profile);
  const t = copyFor(profile.locale);
  useEffect(() => {
    document.documentElement.lang = profile.locale;
  }, [profile.locale]);
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [listening, setListening] = useState(false);
  const [supportDismissed, setSupportDismissed] = useState(false);
  const [supportTriggered, setSupportTriggered] = useState(false);
  const [offlineTipsOpen, setOfflineTipsOpen] = useState(false);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<
    number | null
  >(null);
  const speechSupported = useSyncExternalStore(
    noSubscription,
    isSpeechRecognitionAvailable,
    noSpeechOnServer,
  );
  const showSupportBanner =
    !supportDismissed && (active?.supportNeeded || supportTriggered);
  const guard = useRef(new RequestGuard());
  const requestConversation = useRef<string | null>(null);
  const mediaGeneration = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const externalSettings = (event: StorageEvent) => {
      if (
        event.key === SETTINGS_KEY ||
        event.key === "tutor-ia-api-key-v2" ||
        event.key === null
      ) {
        setSettingsOpen(false);
        setSettingsReady(false);
        reloadSettings()
          .then((value) => {
            setSettings(value);
            setSettingsReady(true);
          })
          .catch((error) =>
            setError(
              error instanceof Error
                ? error.message
                : "Não consegui atualizar as definições.",
            ),
          );
      }
    };
    window.addEventListener("storage", externalSettings);
    return () => window.removeEventListener("storage", externalSettings);
  }, []);

  useEffect(() => {
    if (
      stored.ready &&
      draft.id !== null &&
      !stored.conversations.some((item) => item.id === draft.id)
    )
      saveDraft(stored.activeId, "");
  }, [stored.ready, stored.activeId, stored.conversations, draft.id]);

  useEffect(() => {
    pendingRef.current = pendingImages;
  }, [pendingImages]);
  useEffect(() => {
    blockUpdate(
      !stored.ready ||
        !!stored.error ||
        loading ||
        processing ||
        listening ||
        pendingImages.length > 0 ||
        (!!input && !draft.persisted),
    );
  }, [
    stored.ready,
    stored.error,
    loading,
    processing,
    listening,
    pendingImages.length,
    input,
    draft.persisted,
  ]);

  useEffect(() => {
    loadSettings()
      .then((value) => {
        setSettings(value);
        setSettingsReady(true);
      })
      .catch((error) =>
        setError(
          error instanceof Error
            ? error.message
            : "Não consegui carregar as Definições.",
        ),
      );
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active, pendingUser, loading, pendingImages]);
  useEffect(() => {
    const requests = guard.current;
    return () => {
      requests.cancel();
      stopSpeaking();
      pendingRef.current.forEach(releaseImage);
    };
  }, []);

  useEffect(
    () =>
      conversationStore.subscribe(() => {
        if (
          requestConversation.current &&
          conversationStore.getSnapshot().activeId !==
            requestConversation.current
        ) {
          guard.current.cancel();
          requestConversation.current = null;
          setLoading(false);
          setPendingUser(null);
          setSupportTriggered(false);
          setSupportDismissed(false);
        }
      }),
    [],
  );

  function releaseImage(p: PendingImage) {
    if (p.previewUrl.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
  }
  function updateSubject(next: Subject) {
    if (!loading) void conversationStore.setSubject(next);
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || loading || processing || listening) return;
    if (pendingImages.length + files.length > MAX_IMAGES_PER_MESSAGE) {
      setError("Podes anexar no máximo 4 fotos por mensagem.");
      return;
    }
    const generation = mediaGeneration.current;
    setError(null);
    setProcessing(true);
    try {
      const processed = await processImageFiles(files);
      if (generation !== mediaGeneration.current) return;
      const previews = files.map((file, i) => ({
        id:
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : String(Date.now()) + Math.random(),
        previewUrl: URL.createObjectURL(file),
        image: processed[i],
      }));
      setPendingImages((prev) => {
        const all = [...prev, ...previews];
        all.slice(MAX_IMAGES_PER_MESSAGE).forEach(releaseImage);
        return all.slice(0, MAX_IMAGES_PER_MESSAGE);
      });
    } catch (err) {
      if (generation === mediaGeneration.current)
        setError(
          err instanceof Error
            ? err.message
            : "Não consegui processar a imagem.",
        );
    } finally {
      if (generation === mediaGeneration.current) setProcessing(false);
    }
  }
  async function handleListen() {
    if (listening || loading || processing) return;
    const generation = mediaGeneration.current;
    setError(null);
    setListening(true);
    try {
      const text = await listenOnce(profile.locale);
      if (generation === mediaGeneration.current)
        setInput((prev) => (prev ? prev + " " + text : text).slice(0, 1000));
    } catch (err) {
      if (generation === mediaGeneration.current)
        setError(err instanceof Error ? err.message : "Não consegui ouvir.");
    } finally {
      if (generation === mediaGeneration.current) setListening(false);
    }
  }
  function handleSpeak(index: number, text: string) {
    if (speakingMessageIndex === index) {
      stopSpeaking();
      setSpeakingMessageIndex(null);
      return;
    }
    setSpeakingMessageIndex(index);
    speak(text, () => setSpeakingMessageIndex(null), profile.locale);
  }
  async function handleTakePhoto() {
    if (
      loading ||
      processing ||
      listening ||
      pendingImages.length >= MAX_IMAGES_PER_MESSAGE
    )
      return;
    const generation = mediaGeneration.current;
    setError(null);
    setProcessing(true);
    try {
      const image = await takePhoto();
      if (generation !== mediaGeneration.current) return;
      setPendingImages((prev) =>
        [
          ...prev,
          {
            id:
              typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : String(Date.now()) + Math.random(),
            previewUrl: "data:" + image.mimeType + ";base64," + image.data,
            image,
          },
        ].slice(0, MAX_IMAGES_PER_MESSAGE),
      );
    } catch (err) {
      if (
        generation === mediaGeneration.current &&
        err instanceof Error &&
        err.message !== "Captura cancelada."
      )
        setError(err.message);
    } finally {
      if (generation === mediaGeneration.current) setProcessing(false);
    }
  }
  function removePendingImage(id: string) {
    setPendingImages((prev) => {
      prev.filter((p) => p.id === id).forEach(releaseImage);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function askTutor(
    text: string,
    images: ChatImage[],
    history: ChatMessage[],
    signal: AbortSignal,
    onPhotoContext?: (context: PhotoContext) => void,
  ): Promise<string> {
    return requestTutor(settings, {
      message: text,
      images,
      history,
      subject,
      signal,
      photoContext: active?.photoContext,
      onPhotoContext,
    });
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const draft = input;
    const text =
      input.trim() ||
      (pendingImages.length
        ? profile.locale === "pt-PT"
          ? "Podes ajudar-me com o exercício desta fotografia?"
          : "Pode me ajudar com o exercício desta fotografia?"
        : "");
    if (!text || loading || processing || listening || !stored.ready) return;
    requestConversation.current = null;
    const request = guard.current.begin();
    const images = pendingImages.map((p) => p.image);
    const history = messages;
    setError(null);
    setInput("");
    setLoading(true);
    setPendingUser({ role: "user", text, images });
    if (needsSupportBanner(text)) {
      setSupportTriggered(true);
      setSupportDismissed(false);
    }
    try {
      const id = await conversationStore.ensureActive();
      if (!guard.current.isCurrent(request)) return;
      if (!id)
        throw new TutorError(
          "Não consegui abrir a conversa. Tenta guardar novamente.",
        );
      requestConversation.current = id;
      const current = () =>
        guard.current.isCurrent(request) &&
        conversationStore.getSnapshot().activeId === id;
      const feedback = images.length
        ? null
        : calcFeedback(checkCalculation(text), profile.locale);
      let nextPhotoContext: PhotoContext | null | undefined = images.length
        ? null
        : undefined;
      const reply =
        feedback ??
        (await askTutor(text, images, history, request.signal, (context) => {
          nextPhotoContext = context;
        }));
      if (!current()) return;
      await conversationStore.append(
        id,
        [
          { role: "user", text, images },
          { role: "model", text: reply },
        ],
        false,
        nextPhotoContext,
      );
      if (!current()) return;
      void recordQuestion(subject);
      pendingImages.forEach(releaseImage);
      setPendingImages([]);
    } catch (err) {
      if (!guard.current.isCurrent(request)) return;
      setInput(draft);
      setError(
        err instanceof TutorError
          ? err.message
          : "Não consegui falar com o tutor. Verifica a ligação e tenta de novo.",
      );
      if (
        !(err instanceof TutorError) ||
        err.kind === "network" ||
        !navigator.onLine
      )
        setOfflineTipsOpen(true);
    } finally {
      if (guard.current.isCurrent(request)) {
        setPendingUser(null);
        setLoading(false);
      }
    }
  }

  async function handleExplainSimpler(index: number) {
    if (loading || !active) return;
    const target = messages[index];
    if (!target || target.role !== "model") return;
    const id = active.id;
    const request = guard.current.begin();
    requestConversation.current = id;
    setError(null);
    setLoading(true);
    try {
      const question = messages
        .slice(0, index)
        .reverse()
        .find((m) => m.role === "user");
      const text =
        (profile.locale === "pt-PT"
          ? 'Não entendi a tua última resposta sobre "'
          : 'Não entendi sua última resposta sobre "') +
        (question?.text ?? "a tua última explicação").slice(0, 200) +
        (profile.locale === "pt-PT"
          ? '". Podes explicar de uma forma mais simples, com um exemplo do dia a dia e passos mais curtos?'
          : '". Pode explicar de um jeito mais simples, com um exemplo do dia a dia e etapas menores?');
      const reply = await askTutor(text, [], messages, request.signal);
      if (
        guard.current.isCurrent(request) &&
        conversationStore.getSnapshot().activeId === id
      )
        await conversationStore.append(id, [
          { role: "user", text },
          { role: "model", text: reply },
        ]);
    } catch (err) {
      if (guard.current.isCurrent(request))
        setError(
          err instanceof TutorError
            ? err.message
            : "Não consegui reformular agora. Tenta de novo.",
        );
    } finally {
      if (guard.current.isCurrent(request)) setLoading(false);
    }
  }
  function resetInteraction() {
    requestConversation.current = null;
    guard.current.cancel();
    mediaGeneration.current++;
    stopSpeaking();
    setSpeakingMessageIndex(null);
    setListening(false);
    setProcessing(false);
    pendingImages.forEach(releaseImage);
    setPendingImages([]);
    setPendingUser(null);
    setLoading(false);
    setInput("");
    setError(null);
    setSupportDismissed(false);
    setSupportTriggered(false);
    setOfflineTipsOpen(false);
  }
  function clearChat() {
    resetInteraction();
    void conversationStore.clear();
  }
  function openConversation(conversation: Conversation) {
    resetInteraction();
    void conversationStore.open(conversation.id);
  }

  return (
    <LocaleContext.Provider value={profile.locale}>
      <div className="flex h-[100dvh] min-w-0 flex-col bg-gradient-to-b from-sky-100 to-indigo-100">
        <ServiceWorkerRegister />
        <header className="border-b border-indigo-100 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-2xl">🎓</span>
              <h1 className="text-lg font-bold text-indigo-900">
                {t("Tutor IA")}
              </h1>
              <span className="w-full break-words text-xs text-indigo-700">
                {profileDescription(profile)}
              </span>
              {settings.mode === "direct" && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  {t("modo app")}
                </span>
              )}
            </div>
            <button
              ref={settingsButtonRef}
              disabled={!settingsReady || processing || listening}
              aria-label={t("Definições (pais)")}
              onClick={() => setSettingsOpen(true)}
              title={t("Definições (pais)")}
              className="rounded-full bg-indigo-100 px-3 py-1 text-lg text-indigo-700 transition hover:bg-indigo-200"
            >
              ⚙️
            </button>
            <div className="flex flex-wrap items-center gap-1">
              {SUBJECTS.map((s) => (
                <button
                  key={s}
                  disabled={loading}
                  aria-pressed={subject === s}
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

        <main
          aria-label={t("Conversa com o tutor")}
          className="mx-auto flex min-h-0 min-w-0 w-full max-w-2xl flex-1 flex-col gap-2 overflow-y-auto px-4 py-4"
        >
          {messages.length === 0 && !loading && stored.ready && (
            <div className="mt-10 text-center">
              <div className="mb-4 text-6xl">👋</div>
              <p className="text-lg font-medium text-indigo-900">
                {profile.locale === "pt-PT"
                  ? GREETINGS_PT[subject]
                  : GREETINGS[subject]}
              </p>
              <p className="mt-2 text-sm text-indigo-700">
                {t(
                  "Dica: podes anexar uma foto do teu caderno ou ficha com o botão 📎!",
                )}
              </p>
              <ConversationList
                onOpen={openConversation}
                onDeleted={() => {
                  resetInteraction();
                }}
              />
            </div>
          )}

          {active?.photoContext && (
            <details className="w-full min-w-0 rounded-xl border border-indigo-200 bg-white/80 p-3 text-sm text-indigo-900">
              <summary className="cursor-pointer font-medium">
                {t("Enunciados das últimas fotografias")}
              </summary>
              <p className="mt-2 text-xs text-indigo-600">
                {t(
                  "Disponíveis nesta conversa para as perguntas seguintes. As imagens não são guardadas.",
                )}
              </p>
              <p className="mt-2 break-words">{active.photoContext.summary}</p>
              <ul className="mt-2 space-y-2">
                {active.photoContext.exercises.map((exercise, index) => (
                  <li key={index} className="break-words whitespace-pre-wrap">
                    <strong>
                      {t("Fotografia")} {exercise.photo} · {exercise.label}
                    </strong>
                    <br />
                    {exercise.statement}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {displayMessages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[90%] break-words whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm ${
                m.role === "user"
                  ? "self-end bg-indigo-600 text-white"
                  : "self-start bg-white text-gray-800"
              }`}
            >
              {m.role === "model" && (
                <span className="mb-1 block text-xs font-semibold text-indigo-500">
                  {t("Tutor")}
                </span>
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
                    title={t(
                      speakingMessageIndex === i
                        ? "Parar leitura"
                        : "Ouvir esta resposta",
                    )}
                    className={`text-xs font-medium ${
                      speakingMessageIndex === i
                        ? "text-red-500"
                        : "text-indigo-400 hover:text-indigo-600"
                    }`}
                  >
                    {t(speakingMessageIndex === i ? "⏹️ Parar" : "🔊 Ouvir")}
                  </button>
                  <button
                    onClick={() => handleExplainSimpler(i)}
                    disabled={loading}
                    title={t("Não entendi — explica de uma forma mais simples")}
                    className="text-xs font-medium text-indigo-400 transition hover:text-indigo-600 disabled:opacity-50"
                  >
                    {t("🤔 Não entendi")}
                  </button>
                </span>
              )}
            </div>
          ))}

          {processing && (
            <p role="status" className="text-sm text-indigo-800">
              {t("A preparar a fotografia…")}
            </p>
          )}
          {stored.error && (
            <p
              role="alert"
              className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
            >
              {t(stored.error)}{" "}
              <button
                className="underline"
                onClick={() => void conversationStore.retry()}
              >
                {t("Tentar guardar novamente")}
              </button>
            </p>
          )}

          {loading && (
            <div
              role="status"
              aria-label={t("O tutor está a preparar a resposta")}
              className="flex max-w-[85%] items-center gap-2 self-start rounded-2xl bg-white px-4 py-3 text-gray-500 shadow-sm"
            >
              <span className="animate-bounce">●</span>
              <span className="animate-bounce [animation-delay:150ms]">●</span>
              <span className="animate-bounce [animation-delay:300ms]">●</span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="self-center rounded-xl bg-red-100 px-4 py-2 text-sm text-red-700"
            >
              {t(error)}
            </div>
          )}

          {showSupportBanner && (
            <SupportBanner
              country={profile.country}
              onClose={() => setSupportDismissed(true)}
            />
          )}

          {offlineTipsOpen && !loading && (
            <OfflineTips
              subject={subject}
              onClose={() => setOfflineTipsOpen(false)}
            />
          )}

          <div ref={bottomRef} />
        </main>

        <footer
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          className="border-t border-indigo-100 bg-white/80 backdrop-blur"
        >
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
                    aria-label={t("Remover foto")}
                    title={t("Remover foto")}
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
            className="mx-auto grid w-full max-w-2xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={handleFilesSelected}
            />
            <div className="col-span-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || processing || listening}
                aria-label={t("Anexar foto da galeria")}
                title={t("Anexar foto da galeria")}
                className="rounded-full bg-indigo-100 px-3 py-2 text-xl text-indigo-700 transition hover:bg-indigo-200 disabled:opacity-50"
              >
                📎
              </button>
              <button
                type="button"
                onClick={handleTakePhoto}
                disabled={loading || processing || listening}
                aria-label={t("Tirar foto com a câmara")}
                title={t("Tirar foto com a câmara")}
                className="rounded-full bg-indigo-100 px-3 py-2 text-xl text-indigo-700 transition hover:bg-indigo-200 disabled:opacity-50"
              >
                📷
              </button>
              {speechSupported && (
                <button
                  type="button"
                  onClick={handleListen}
                  disabled={loading || listening || processing}
                  aria-label={t("Ditar pergunta")}
                  title={t(
                    listening
                      ? "A ouvir... fala agora"
                      : "Falar em vez de escrever",
                  )}
                  className={`rounded-full px-3 py-2 text-xl transition disabled:opacity-50 ${
                    listening
                      ? "animate-pulse bg-red-500 text-white"
                      : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                  }`}
                >
                  🎤
                </button>
              )}
            </div>
            <input
              aria-label={t("A tua pergunta")}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("Escreve a tua dúvida aqui...")}
              maxLength={1000}
              disabled={loading}
              // Teclado com correção automática e sugestões de palavras (pt-BR)
              autoComplete="on"
              autoCorrect="on"
              autoCapitalize="sentences"
              spellCheck={true}
              lang={profile.locale}
              inputMode="text"
              className="min-w-0 w-full rounded-full border border-indigo-200 bg-white px-4 py-2 text-[15px] text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={
                !stored.ready ||
                loading ||
                processing ||
                listening ||
                (!input.trim() && pendingImages.length === 0)
              }
              className="rounded-full bg-indigo-600 px-5 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {t("Enviar")}
            </button>
            {(messages.length > 0 || loading || processing) && (
              <button
                type="button"
                onClick={clearChat}
                aria-label={t("Limpar conversa")}
                title={t("Limpar conversa")}
                className="col-span-2 justify-self-end rounded-full bg-gray-200 px-3 py-2 text-gray-600 transition hover:bg-gray-300"
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
              stopSpeaking();
              setSpeakingMessageIndex(null);
              if (loading) {
                if (pendingUser) setInput(pendingUser.text);
                requestConversation.current = null;
                guard.current.cancel();
                setPendingUser(null);
                setLoading(false);
              }
              setSettings(next);
              setSettingsOpen(false);
              setError(null);
            }}
          />
        )}
      </div>
    </LocaleContext.Provider>
  );
}
