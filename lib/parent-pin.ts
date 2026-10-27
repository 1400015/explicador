"use client";
import { Preferences } from "@capacitor/preferences";
import { createPinSecurity, type PinAttempts } from "./pin-security";
import {
  isNativeApp,
  reloadSettings,
  setPin,
  SecureSettings,
} from "./settings";

const KEY = "tutor-ia-pin-attempts-v2";
const verify = createPinSecurity({
  read: async () => {
    const raw = isNativeApp()
      ? ((await SecureSettings.readState({ key: "pinAttempts" })).value ??
        (await Preferences.get({ key: KEY })).value)
      : localStorage.getItem(KEY);
    if (!raw) return { failures: 0, blockedUntil: 0 };
    const value = JSON.parse(raw) as PinAttempts;
    if (
      !Number.isInteger(value.failures) ||
      value.failures < 0 ||
      !Number.isFinite(value.blockedUntil) ||
      value.blockedUntil < 0
    )
      throw new Error("O estado de proteção do PIN não pôde ser lido.");
    return value;
  },
  write: async (value) => {
    const raw = JSON.stringify(value);
    if (isNativeApp()) {
      await SecureSettings.writeState({ key: "pinAttempts", value: raw });
      if (
        ((await SecureSettings.readState({ key: "pinAttempts" })).value ??
          (await Preferences.get({ key: KEY })).value) !== raw
      )
        throw new Error("Não foi possível guardar a proteção do PIN.");
    } else {
      localStorage.setItem(KEY, raw);
      if (localStorage.getItem(KEY) !== raw)
        throw new Error("Não foi possível guardar a proteção do PIN.");
    }
  },
  current: async () => (await reloadSettings()).pin,
  upgrade: async (pin) => {
    await setPin(pin);
  },
});
export async function verifyParentPin(pin: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(KEY, async () => verify(pin));
  return verify(pin);
}
