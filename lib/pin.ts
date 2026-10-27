export type PinHash = {
  hash: string;
  salt: string;
  version?: 2;
  algorithm?: "pbkdf2-sha256";
  iterations?: number;
};
export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;
export const PIN_ITERATIONS = 600_000;
const hex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
export function isValidPinFormat(pin: string) {
  return /^\d{4,6}$/.test(pin);
}

/** O formato antigo é mantido apenas para verificar e migrar instalações existentes. */
export async function hashPin(pin: string, salt?: string): Promise<PinHash> {
  const actualSalt =
    salt ?? hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(actualSalt + ":" + pin),
  );
  return { hash: hex(hash), salt: actualSalt };
}
export async function createPinHash(pin: string): Promise<PinHash> {
  if (!isValidPinFormat(pin)) throw new Error("O PIN deve ter 4 a 6 dígitos.");
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return {
    hash: await derive(pin, salt, PIN_ITERATIONS),
    salt,
    version: 2,
    algorithm: "pbkdf2-sha256",
    iterations: PIN_ITERATIONS,
  };
}
async function derive(
  pin: string,
  salt: string,
  iterations: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations,
        salt: new TextEncoder().encode(salt),
      },
      key,
      256,
    ),
  );
}
export async function verifyPin(pin: string, saved: PinHash): Promise<boolean> {
  if (
    !isValidPinFormat(pin) ||
    !/^[a-f0-9]{64}$/.test(saved.hash) ||
    saved.salt.length > 128
  )
    return false;
  let candidate: string;
  if (
    saved.version === 2 &&
    saved.algorithm === "pbkdf2-sha256" &&
    saved.iterations &&
    saved.iterations >= PIN_ITERATIONS &&
    saved.iterations <= 1_200_000
  )
    candidate = await derive(pin, saved.salt, saved.iterations);
  else if (saved.version === undefined && saved.algorithm === undefined)
    candidate = (await hashPin(pin, saved.salt)).hash;
  else return false;
  let difference = 0;
  for (let i = 0; i < candidate.length; i++)
    difference |= candidate.charCodeAt(i) ^ saved.hash.charCodeAt(i);
  return difference === 0;
}
