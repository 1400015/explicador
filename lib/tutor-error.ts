import type { ApiErrorKind } from "./api-error";

export class TutorError extends Error {
  constructor(
    message: string,
    readonly kind?: ApiErrorKind,
    readonly diagnostic?: string,
  ) {
    super(message);
  }
}

/** Compatível com WebViews sem AbortSignal.throwIfAborted. */
export function ensureNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new TutorError("O pedido foi interrompido.");
}
