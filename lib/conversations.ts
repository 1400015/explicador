"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isNativeApp } from "./settings";
import {
  CONVERSATION_KEY,
  createConversationStore,
} from "./conversation-store";
import type { Conversation } from "./conversation-store";
export type { Conversation, StoredMessage } from "./conversation-store";

const LEGACY_ARCHIVE = "tutor-ia-conversations-v1";
const LEGACY_ACTIVE = "tutor-ia-history-v1";
async function readKey(key: string) {
  if (isNativeApp()) {
    const { Preferences } = await import("@capacitor/preferences");
    return (await Preferences.get({ key })).value;
  }
  return localStorage.getItem(key);
}
export const conversationStore = createConversationStore({
  read: () => readKey(CONVERSATION_KEY),
  write: async (value) => {
    if (isNativeApp()) {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key: CONVERSATION_KEY, value });
    } else localStorage.setItem(CONVERSATION_KEY, value);
  },
  legacy: async () => ({
    archive: await readKey(LEGACY_ARCHIVE),
    active: localStorage.getItem(LEGACY_ACTIVE),
  }),
  removeLegacy: async () => {
    if (isNativeApp()) {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.remove({ key: LEGACY_ARCHIVE });
    }
    localStorage.removeItem(LEGACY_ARCHIVE);
    localStorage.removeItem(LEGACY_ACTIVE);
  },
  exclusive: async (work) =>
    typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request(CONVERSATION_KEY, work)
      : work(),
});

export function useConversations() {
  const snapshot = useSyncExternalStore(
    conversationStore.subscribe,
    conversationStore.getSnapshot,
    conversationStore.getServerSnapshot,
  );
  useEffect(() => {
    void conversationStore.initialize();
    const refresh = (event: StorageEvent) => {
      if (event.key === CONVERSATION_KEY || event.key === null)
        void conversationStore.refresh();
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  return snapshot;
}
export async function loadConversations() {
  await conversationStore.initialize();
  return conversationStore.getSnapshot().conversations;
}
export const saveConversations = (items: Conversation[]) =>
  conversationStore.replace(items);
export const upsertConversation = (item: Conversation) =>
  conversationStore.upsert(item);
export const deleteConversation = (id: string) => conversationStore.delete(id);
