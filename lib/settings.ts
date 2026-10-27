"use client";

import { Preferences } from "@capacitor/preferences";
import { registerPlugin } from "@capacitor/core";
import { clearDirectClients } from "./gemini-client";
import { createSettingsStore } from "./settings-store";
export type { AppSettings } from "./settings-store";
export type TutorMode = "server" | "direct";

export const SETTINGS_KEY = "tutor-ia-settings-v1";
const BROWSER_KEY = "tutor-ia-api-key-v2";
export const SecureSettings = registerPlugin<{
  get(): Promise<{ value: string | null }>;
  set(options: { value: string }): Promise<void>;
  remove(): Promise<void>;
  readState(options: {
    key: "settings" | "pinAttempts";
  }): Promise<{ value: string | null }>;
  writeState(options: {
    key: "settings" | "pinAttempts";
    value: string;
  }): Promise<void>;
  removeLegacy(): Promise<void>;
}>("SecureSettings");

export function isNativeApp(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(
      window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
    ).Capacitor?.isNativePlatform?.()
  );
}
let instance: ReturnType<typeof createSettingsStore> | undefined;
function repository() {
  return (instance ??= createSettingsStore({
    native: isNativeApp(),
    read: async () =>
      isNativeApp()
        ? ((await SecureSettings.readState({ key: "settings" })).value ??
          (await Preferences.get({ key: SETTINGS_KEY })).value)
        : localStorage.getItem(SETTINGS_KEY),
    write: async (value) => {
      if (isNativeApp()) {
        await SecureSettings.writeState({ key: "settings", value });
        await SecureSettings.removeLegacy();
      } else localStorage.setItem(SETTINGS_KEY, value);
    },
    getKey: async (persistent) =>
      isNativeApp()
        ? ((await SecureSettings.get()).value ?? null)
        : (persistent ? localStorage : sessionStorage).getItem(BROWSER_KEY),
    setKey: async (value, persistent) => {
      if (isNativeApp()) await SecureSettings.set({ value });
      else
        (persistent ? localStorage : sessionStorage).setItem(
          BROWSER_KEY,
          value,
        );
    },
    removeKey: async (persistent) => {
      if (isNativeApp()) await SecureSettings.remove();
      else (persistent ? localStorage : sessionStorage).removeItem(BROWSER_KEY);
    },
  }));
}
export const reloadSettings = () => repository().reload();
export const loadSettings = () => repository().load();
export async function saveSettings(
  settings: import("./settings-store").AppSettings,
) {
  const result = await repository().save(settings);
  clearDirectClients();
  return result;
}
export async function clearApiKey() {
  const result = await repository().clear();
  clearDirectClients();
  return result;
}
export const setPin = (pin: import("./pin").PinHash | null) =>
  repository().setPin(pin);
