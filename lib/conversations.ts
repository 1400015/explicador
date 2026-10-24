"use client";

import { Subject } from "./prompt";
import { MAX_HISTORY_MESSAGES } from "./shared";

export type StoredMessage = { role: "user" | "model"; text: string };

export type Conversation = {
  id: string;
  subject: Subject;
  /** ISO timestamp da última mensagem */
  updatedAt: number;
  messages: StoredMessage[];
};

const CONVERSATIONS_KEY = "tutor-ia-conversations-v1";
const MAX_STORED_CONVERSATIONS = 5;

function isCapacitorNative(): boolean {
  return (
    typeof window !== "undefined" &&
    // @ts-expect-error Capacitor injeta este objeto na app nativa
    !!window.Capacitor?.isNativePlatform?.()
  );
}

function sanitizeConversations(raw: unknown): Conversation[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is Conversation =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as Conversation).id === "string" &&
      Array.isArray((c as Conversation).messages) &&
      typeof (c as Conversation).updatedAt === "number" &&
      typeof (c as Conversation).subject === "string"
  );
}

let memoryCache: Conversation[] | null = null;

export async function loadConversations(): Promise<Conversation[]> {
  if (memoryCache) return memoryCache;
  try {
    if (isCapacitorNative()) {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: CONVERSATIONS_KEY });
      memoryCache = value ? sanitizeConversations(JSON.parse(value)) : [];
    } else {
      const saved = localStorage.getItem(CONVERSATIONS_KEY);
      memoryCache = saved ? sanitizeConversations(JSON.parse(saved)) : [];
    }
  } catch {
    memoryCache = [];
  }
  return memoryCache;
}

export async function saveConversations(conversations: Conversation[]): Promise<void> {
  const trimmed = conversations
    .map((c) => ({ ...c, messages: c.messages.slice(-MAX_HISTORY_MESSAGES) }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_STORED_CONVERSATIONS);
  memoryCache = trimmed;
  const serialized = JSON.stringify(trimmed);
  try {
    if (isCapacitorNative()) {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key: CONVERSATIONS_KEY, value: serialized });
    } else {
      localStorage.setItem(CONVERSATIONS_KEY, serialized);
    }
  } catch {
    // armazenamento indisponível: segue só em memória
  }
}

export async function upsertConversation(conversation: Conversation): Promise<void> {
  const conversations = await loadConversations();
  const withoutThis = conversations.filter((c) => c.id !== conversation.id);
  await saveConversations([...withoutThis, conversation]);
}

export async function deleteConversation(id: string): Promise<void> {
  const conversations = await loadConversations();
  await saveConversations(conversations.filter((c) => c.id !== id));
}
