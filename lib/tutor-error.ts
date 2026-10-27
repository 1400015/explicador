import type { ApiErrorKind } from "./api-error";

export class TutorError extends Error {
  constructor(
    message: string,
    readonly kind?: ApiErrorKind,
  ) {
    super(message);
  }
}
