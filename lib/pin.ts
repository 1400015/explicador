"use client";

export type PinHash = {
  hash: string;
  salt: string;
};

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

export function isValidPinFormat(pin: string): boolean {
  return (
    new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`).test(pin)
  );
}

export async function hashPin(pin: string, salt?: string): Promise<PinHash> {
  const effectiveSalt = salt ?? randomSalt();
  const data = new TextEncoder().encode(`${effectiveSalt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return { hash: toHex(digest), salt: effectiveSalt };
}

export async function verifyPin(pin: string, pinHash: PinHash): Promise<boolean> {
  if (!isValidPinFormat(pin)) return false;
  const candidate = await hashPin(pin, pinHash.salt);
  return candidate.hash === pinHash.hash;
}

export async function createPinHash(pin: string): Promise<PinHash> {
  return hashPin(pin);
}
