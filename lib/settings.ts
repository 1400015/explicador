"use client";

import { Preferences } from "@capacitor/preferences";
import type { PinHash } from "./pin";

export type TutorMode = "server" | "direct";

export type AppSettings = {
  mode: TutorMode;
  apiKey: string;
  /** URL do servidor próprio (modo "server"). Vazio = usa o servidor onde a app web está publicada. */
  serverUrl: string;
  pin: PinHash | null;
};

const SETTINGS_KEY = "tutor-ia-settings-v1";

const DEFAULT_SETTINGS: AppSettings = {
  mode: "server",
  apiKey: "",
  serverUrl: "",
  pin: null,
};

function isCapacitorNative(): boolean {
  return typeof window !== "undefined" &&
    // @ts-expect-error Capacitor injeta este objeto na app nativa
    !!window.Capacitor?.isNativePlatform?.();
}

export function isNativeApp(): boolean {
  return isCapacitorNative();
}

function migrate(raw: AppSettings): AppSettings {
  // Definições antigas (sem serverUrl) recebem o valor predefinido.
  if (typeof raw.serverUrl !== "string") {
    return { ...DEFAULT_SETTINGS, ...raw, serverUrl: "" };
  }
  return raw;
}

let memoryCache: AppSettings | null = null;

export async function loadSettings(): Promise<AppSettings> {
  if (memoryCache) return memoryCache;
  try {
    if (isCapacitorNative()) {
      const { value } = await Preferences.get({ key: SETTINGS_KEY });
      memoryCache = value ? migrate(JSON.parse(value) as AppSettings) : DEFAULT_SETTINGS;
    } else {
      const saved = localStorage.getItem(SETTINGS_KEY);
      memoryCache = saved ? migrate(JSON.parse(saved) as AppSettings) : DEFAULT_SETTINGS;
    }
  } catch {
    memoryCache = DEFAULT_SETTINGS;
  }
  return memoryCache;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  memoryCache = settings;
  const serialized = JSON.stringify(settings);
  try {
    if (isCapacitorNative()) {
      await Preferences.set({ key: SETTINGS_KEY, value: serialized });
    } else {
      localStorage.setItem(SETTINGS_KEY, serialized);
    }
  } catch {
    // armazenamento indisponível: segue só em memória
  }
}

export async function clearApiKey(): Promise<void> {
  const settings = await loadSettings();
  await saveSettings({ ...settings, apiKey: "", mode: "server" });
}export async function setPin(pinHash: PinHash | null): Promise<void> {
  const settings = await loadSettings();
  await saveSettings({ ...settings, pin: pinHash });
}
