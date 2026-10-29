import { apiErrorDiagnostic } from "./api-error";
import { modelName } from "./model-config";
import { ensureNotAborted } from "./tutor-error";

const diagnostics = new WeakMap<object, string>();
const retryableStatuses = new Set([500, 502, 503, 504]);

/** Referências fixas das tentativas, sem mensagens ou dados da resposta. */
export function availabilityDiagnostic(error: unknown): string | undefined {
  if (
    (typeof error === "object" && error !== null) ||
    typeof error === "function"
  )
    return diagnostics.get(error);
  return undefined;
}

async function waitForAvailability(signal?: AbortSignal): Promise<void> {
  ensureNotAborted(signal);
  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, 1000 + Math.floor(Math.random() * 251));
    signal?.addEventListener("abort", finish, { once: true });
    if (signal?.aborted) finish();
  });
  ensureNotAborted(signal);
}

/** Uma segunda tentativa apenas para indisponibilidade HTTP transitória. */
export async function requestWithAvailability<T>(
  call: (model: string) => Promise<T>,
  primaryModel: string,
  fallbackModel: string,
  signal?: AbortSignal,
): Promise<T> {
  ensureNotAborted(signal);
  const primary = modelName(primaryModel);
  const fallback = modelName(fallbackModel);
  const attempts: string[] = [];

  const attempt = async (model: string): Promise<T> => {
    ensureNotAborted(signal);
    try {
      const result = await call(model);
      ensureNotAborted(signal);
      return result;
    } catch (error) {
      attempts.push(`${model}:${apiErrorDiagnostic(error)}`);
      if (
        (typeof error === "object" && error !== null) ||
        typeof error === "function"
      )
        diagnostics.set(error, attempts.join(">"));
      throw error;
    }
  };

  try {
    return await attempt(primary);
  } catch (error) {
    ensureNotAborted(signal);
    const status = (error as { status?: unknown } | null)?.status;
    if (typeof status !== "number" || !retryableStatuses.has(status))
      throw error;
    await waitForAvailability(signal);
    return attempt(fallback);
  }
}
