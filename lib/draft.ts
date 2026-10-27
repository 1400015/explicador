"use client";
import { useSyncExternalStore } from "react";
const KEY = "tutor-ia-draft-v2";
type Draft = { id: string | null; text: string; persisted: boolean };
const EMPTY: Draft = { id: null, text: "", persisted: true };
let cache: Draft | null = null;
const listeners = new Set<() => void>();
function snapshot(): Draft {
  if (cache) return cache;
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    cache =
      value &&
      (value.id === null || typeof value.id === "string") &&
      typeof value.text === "string"
        ? { id: value.id, text: value.text.slice(0, 1000), persisted: true }
        : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache!;
}
export function saveDraft(id: string | null, text: string) {
  let persisted = false;
  try {
    const raw = JSON.stringify({ id, text });
    sessionStorage.setItem(KEY, raw);
    persisted = sessionStorage.getItem(KEY) === raw;
  } catch {}
  cache = { id, text, persisted };
  listeners.forEach((listener) => listener());
}
export function updateDraft(
  id: string | null,
  value: string | ((text: string) => string),
) {
  const current = snapshot();
  saveDraft(
    id,
    typeof value === "function"
      ? value(current.id === id ? current.text : "")
      : value,
  );
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function useDraft() {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
