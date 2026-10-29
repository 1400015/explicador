import { SUBJECT_LABELS, type Subject } from "./prompt";
import { MAX_HISTORY_MESSAGES, type ChatMessage } from "./shared";
import { needsSupportBanner } from "./support";
import { readPhotoContext, type PhotoContext } from "./photo-context";

export type StoredMessage = ChatMessage;
export type Conversation = {
  id: string;
  subject: Subject;
  updatedAt: number;
  messages: ChatMessage[];
  supportNeeded?: boolean;
  photoContext?: PhotoContext;
};
export type ConversationState = {
  version: 2;
  activeId: string | null;
  subject: Subject;
  conversations: Conversation[];
  ready: boolean;
  error: string | null;
};
export const EMPTY_CONVERSATIONS: ConversationState = {
  version: 2,
  activeId: null,
  subject: "geral",
  conversations: [],
  ready: false,
  error: null,
};
export const CONVERSATION_KEY = "tutor-ia-conversations-v2";
export interface ConversationStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  legacy(): Promise<{ archive: string | null; active: string | null }>;
  removeLegacy(): Promise<void>;
  exclusive?<T>(work: () => Promise<T>): Promise<T>;
}
const object = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const subjectOf = (x: unknown): Subject =>
  typeof x === "string" && Object.hasOwn(SUBJECT_LABELS, x)
    ? (x as Subject)
    : "geral";
function parse(raw: string | null): unknown {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function messagesOf(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m) =>
        object(m) &&
        (m.role === "user" || m.role === "model") &&
        typeof m.text === "string" &&
        m.text.length <= 8000,
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map(({ role, text }) => ({ role, text }));
}
function conversationsOf(raw: unknown): Conversation[] {
  if (!Array.isArray(raw)) return [];
  const found = new Map<string, Conversation>();
  for (const c of raw) {
    if (
      !object(c) ||
      typeof c.id !== "string" ||
      !c.id ||
      !Array.isArray(c.messages) ||
      typeof c.updatedAt !== "number" ||
      !Number.isFinite(c.updatedAt)
    )
      continue;
    const messages = messagesOf(c.messages);
    const item = {
      id: c.id,
      subject: subjectOf(c.subject),
      updatedAt: c.updatedAt,
      messages,
      photoContext: readPhotoContext(c.photoContext) ?? undefined,
      supportNeeded:
        c.supportNeeded === true ||
        messages.some((m) => m.role === "user" && needsSupportBanner(m.text)),
    };
    if (!found.has(item.id) || found.get(item.id)!.updatedAt < item.updatedAt)
      found.set(item.id, item);
  }
  return [...found.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);
}
function decode(raw: string | null): ConversationState | null {
  const value = parse(raw);
  if (
    !object(value) ||
    value.version !== 2 ||
    !Array.isArray(value.conversations)
  )
    return null;
  const conversations = conversationsOf(value.conversations);
  const activeId = conversations.some((c) => c.id === value.activeId)
    ? (value.activeId as string)
    : null;
  return {
    version: 2,
    activeId,
    subject: activeId
      ? conversations.find((c) => c.id === activeId)!.subject
      : subjectOf(value.subject),
    conversations,
    ready: true,
    error: null,
  };
}
function serialize(state: ConversationState): string {
  return JSON.stringify({
    version: 2,
    activeId: state.activeId,
    subject: state.subject,
    conversations: state.conversations.map((c) => ({
      ...c,
      messages: c.messages.map(({ role, text }) => ({ role, text })),
    })),
  });
}

function newId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "c-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

export function createConversationStore(storage: ConversationStorage) {
  let state = EMPTY_CONVERSATIONS;
  let queue = Promise.resolve();
  let initialized: Promise<void> | undefined;
  let canWrite = false;
  let lastSaved: string | null = null;
  const listeners = new Set<() => void>();
  const emit = (next: ConversationState) => {
    state = next;
    listeners.forEach((l) => l());
  };
  const schedule = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(() =>
      storage.exclusive ? storage.exclusive(work) : work(),
    );
    queue = next.then(
      () => {},
      () => {},
    );
    return next;
  };
  const failure = () =>
    emit({
      ...state,
      ready: true,
      error:
        "Não consegui guardar ou apagar os dados no dispositivo. Mantém a app aberta e tenta novamente.",
    });
  async function persist() {
    const value = serialize(state);
    await storage.write(value);
    if ((await storage.read()) !== value)
      throw new Error("Falha na confirmação da gravação");
    lastSaved = value;
    await storage.removeLegacy();
  }
  function initialize(): Promise<void> {
    return (initialized ??= schedule(async () => {
      try {
        const raw = await storage.read();
        const saved = decode(raw);
        if (saved) {
          canWrite = true;
          lastSaved = raw;
          emit(saved);
          await storage.removeLegacy();
          return;
        }
        if (raw !== null)
          throw new Error("Formato de armazenamento desconhecido");
        const legacy = await storage.legacy();
        const conversations = conversationsOf(parse(legacy.archive));
        const active = parse(legacy.active);
        const subject = object(active) ? subjectOf(active.subject) : "geral";
        const messages = object(active) ? messagesOf(active.messages) : [];
        let activeId: string | null = null;
        if (messages.length) {
          const matches = conversations.filter(
            (c) =>
              c.subject === subject &&
              JSON.stringify(c.messages) === JSON.stringify(messages),
          );
          const current =
            matches.length === 1
              ? matches[0]
              : {
                  id: newId(),
                  subject,
                  messages,
                  updatedAt: Date.now(),
                  supportNeeded: messages.some(
                    (m) => m.role === "user" && needsSupportBanner(m.text),
                  ),
                };
          activeId = current.id;
          if (matches.length !== 1) conversations.unshift(current);
        }
        canWrite = true;
        emit({
          version: 2,
          activeId,
          subject,
          conversations: conversations.slice(0, 5),
          ready: true,
          error: null,
        });
        await persist();
      } catch {
        if (!canWrite) initialized = undefined;
        failure();
      }
    }));
  }
  async function mutate(work: (s: ConversationState) => ConversationState) {
    await initialize();
    if (!canWrite) return;
    await schedule(async () => {
      try {
        const raw = await storage.read();
        if (raw === null && lastSaved !== null)
          state = { ...EMPTY_CONVERSATIONS, ready: true };
        if (raw !== lastSaved && raw !== null) {
          const fresh = decode(raw);
          if (!fresh) throw new Error("Formato de armazenamento desconhecido");
          state = fresh;
        }
        emit({ ...work(state), ready: true, error: null });
        await persist();
      } catch {
        failure();
      }
    });
  }
  return {
    initialize,
    getSnapshot: () => state,
    getServerSnapshot: () => EMPTY_CONVERSATIONS,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    retry: () => mutate((s) => s),
    refresh: async () => {
      await initialize();
      await schedule(async () => {
        try {
          const raw = await storage.read();
          if (raw === lastSaved) return;
          const fresh =
            raw === null
              ? { ...EMPTY_CONVERSATIONS, ready: true }
              : decode(raw);
          if (!fresh) throw new Error("Dados inválidos");
          lastSaved = raw;
          emit(fresh);
        } catch {
          failure();
        }
      });
    },
    async ensureActive(): Promise<string | null> {
      const id = newId();
      await mutate((s) =>
        s.activeId
          ? s
          : {
              ...s,
              activeId: id,
              conversations: [
                { id, subject: s.subject, updatedAt: Date.now(), messages: [] },
                ...s.conversations,
              ].slice(0, 5),
            },
      );
      return state.activeId;
    },
    setSubject: (subject: Subject) =>
      mutate((s) => ({
        ...s,
        subject,
        conversations: s.conversations.map((c) =>
          c.id === s.activeId ? { ...c, subject } : c,
        ),
      })),
    async append(
      id: string | null,
      messages: ChatMessage[],
      create = false,
      photoContext?: PhotoContext | null,
    ): Promise<string | null> {
      const nextId = id ?? newId();
      await mutate((s) => {
        if (!create && s.activeId !== id) return s;
        const previous = s.conversations.find((c) => c.id === nextId);
        const next: Conversation = {
          id: nextId,
          subject: s.subject,
          updatedAt: Date.now(),
          photoContext:
            photoContext === undefined
              ? previous?.photoContext
              : (readPhotoContext(photoContext) ?? undefined),
          messages: [...(previous?.messages ?? []), ...messages].slice(
            -MAX_HISTORY_MESSAGES,
          ),
          supportNeeded:
            previous?.supportNeeded ||
            messages.some(
              (m) => m.role === "user" && needsSupportBanner(m.text),
            ),
        };
        return {
          ...s,
          activeId: nextId,
          conversations: [
            next,
            ...s.conversations.filter((c) => c.id !== nextId),
          ].slice(0, 5),
        };
      });
      return state.activeId === nextId ? nextId : null;
    },
    open: (id: string) =>
      mutate((s) => {
        const c = s.conversations.find((c) => c.id === id);
        return c ? { ...s, activeId: id, subject: c.subject } : s;
      }),
    clear: () =>
      mutate((s) => ({
        ...s,
        activeId: null,
        conversations: s.conversations.filter((c) => c.id !== s.activeId),
      })),
    delete: (id: string) =>
      mutate((s) => ({
        ...s,
        activeId: s.activeId === id ? null : s.activeId,
        conversations: s.conversations.filter((c) => c.id !== id),
      })),
    replace: (conversations: Conversation[]) =>
      mutate((s) => ({
        ...s,
        activeId: null,
        conversations: conversationsOf(conversations),
      })),
    upsert: (c: Conversation) =>
      mutate((s) => ({
        ...s,
        conversations: conversationsOf([
          c,
          ...s.conversations.filter((item) => item.id !== c.id),
        ]),
      })),
  };
}
