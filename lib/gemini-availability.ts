import { apiErrorDiagnostic } from "./api-error";
import { modelName } from "./model-config";
import { TutorError, ensureNotAborted } from "./tutor-error";

export const GENERATION_ATTEMPT_TIMEOUT_MS = 20_000;

const diagnostics = new WeakMap<object, string>();
const retryableStatuses = new Set([500, 502, 503, 504]);
const terminalDiagnostics = new Set([
  "DNS",
  "TLS",
  "JS_TYPE",
  "RESPONSE_INVALID",
  "NATIVE_ERROR",
  "PLUGIN_UNAVAILABLE",
]);

function httpStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" &&
    Number.isInteger(status) &&
    status >= 100 &&
    status <= 599
    ? status
    : undefined;
}

function attemptTimeout(error?: unknown): unknown {
  const diagnostic = apiErrorDiagnostic(error);
  // Uma resposta HTTP, bloqueio ou falha de TLS/DNS mantém a causa original.
  if (
    error instanceof TutorError ||
    httpStatus(error) !== undefined ||
    terminalDiagnostics.has(diagnostic) ||
    diagnostic.startsWith("HTTP_")
  )
    return error;
  return Object.assign(new Error("A tentativa de geração demorou demasiado."), {
    name: "TimeoutError",
    code: "ATTEMPT_TIMEOUT",
  });
}

function canRetry(error: unknown): boolean {
  if (error instanceof TutorError) return false;
  const status = httpStatus(error);
  if (status !== undefined) return retryableStatuses.has(status);
  const diagnostic = apiErrorDiagnostic(error);
  if (terminalDiagnostics.has(diagnostic) || diagnostic.startsWith("HTTP_"))
    return false;
  const value = error as {
    name?: unknown;
    code?: unknown;
    message?: unknown;
  } | null;
  if (value?.name === "AbortError") return false;
  return (
    value?.code === "ATTEMPT_TIMEOUT" ||
    value?.code === "SocketTimeoutException" ||
    value?.code === "ETIMEDOUT" ||
    value?.name === "TimeoutError" ||
    (typeof value?.message === "string" &&
      /\btimeout\b|\btimed\s*out\b|\bETIMEDOUT\b/i.test(value.message))
  );
}

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

/** Uma segunda tentativa para indisponibilidade HTTP ou timeout de geração. */
export async function requestWithAvailability<T>(
  call: (model: string, attemptSignal: AbortSignal) => Promise<T>,
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
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, GENERATION_ATTEMPT_TIMEOUT_MS);
    try {
      // O HTTP nativo não cancela por signal: aguardar sempre o seu término.
      const result = await call(model, controller.signal);
      ensureNotAborted(signal);
      if (timedOut) throw attemptTimeout();
      return result;
    } catch (error) {
      ensureNotAborted(signal);
      const failure = timedOut ? attemptTimeout(error) : error;
      attempts.push(`${model}:${apiErrorDiagnostic(failure)}`);
      if (
        (typeof failure === "object" && failure !== null) ||
        typeof failure === "function"
      )
        diagnostics.set(failure, attempts.join(">"));
      throw failure;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    }
  };

  try {
    return await attempt(primary);
  } catch (error) {
    ensureNotAborted(signal);
    if (!canRetry(error)) throw error;
    await waitForAvailability(signal);
    return attempt(fallback);
  }
}
