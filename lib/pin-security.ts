import { createPinHash, verifyPin, type PinHash } from "./pin";
export type PinAttempts = { failures: number; blockedUntil: number };
export function createPinSecurity(deps: {
  read(): Promise<PinAttempts>;
  write(state: PinAttempts): Promise<void>;
  current(): Promise<PinHash | null>;
  upgrade(pin: PinHash): Promise<void>;
  now?: () => number;
}) {
  let queue = Promise.resolve();
  return (pin: string): Promise<boolean> => {
    const work = queue.then(async () => {
      const now = (deps.now ?? Date.now)();
      const attempts = await deps.read();
      if (attempts.blockedUntil > now)
        throw new Error(
          "Aguarda " +
            Math.ceil((attempts.blockedUntil - now) / 1000) +
            " segundos antes de tentar o PIN novamente.",
        );
      const saved = await deps.current();
      if (!saved) return false;
      const valid = await verifyPin(pin, saved);
      if (valid) {
        if (saved.version !== 2) await deps.upgrade(await createPinHash(pin));
        await deps.write({ failures: 0, blockedUntil: 0 });
      } else {
        const failures = Math.min(30, attempts.failures + 1);
        const delay =
          failures < 3 ? 0 : Math.min(300_000, 1000 * 2 ** (failures - 3));
        await deps.write({ failures, blockedUntil: now + delay });
      }
      return valid;
    });
    queue = work.then(
      () => {},
      () => {},
    );
    return work;
  };
}
