"use client";
import { useSyncExternalStore } from "react";
let blocked = true;
const listeners = new Set<() => void>();
export function blockUpdate(value: boolean) {
  if (blocked !== value) {
    blocked = value;
    listeners.forEach((listener) => listener());
  }
}
export function useUpdateBlocked() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => blocked,
    () => true,
  );
}
