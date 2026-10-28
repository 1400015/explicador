import type { Subject } from "./prompt";
import type { ChatImage, ChatMessage } from "./shared";
import { prepareHistory } from "./history";
import { TutorError, ensureNotAborted } from "./tutor-error";

export type ConnectionSettings = {
  mode: "direct" | "server";
  apiKey: string;
  serverUrl: string;
  allowLocalHttp?: boolean;
};
export type TutorQuestion = {
  message: string;
  subject: Subject;
  images: ChatImage[];
  history: ChatMessage[];
  signal?: AbortSignal;
};

export function serverEndpoint(value: string, allowLocalHttp = false): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new TutorError(
      "Indica um endereço de servidor válido nas Definições.",
    );
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const parts = host.split(".").map(Number);
  const local =
    host === "localhost" ||
    host === "::1" ||
    /^f[cd][0-9a-f]{2}:|^fe[89ab][0-9a-f]:/i.test(host) ||
    (parts.length === 4 &&
      parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
      (parts[0] === 10 ||
        parts[0] === 127 ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 169 && parts[1] === 254)));
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && local && allowLocalHttp))
  )
    throw new TutorError(
      "Usa HTTPS. HTTP só é permitido para um endereço local quando a opção de rede local está ativa.",
    );
  return url.href.replace(/\/+$/, "") + "/api/chat";
}

export function createTutorTransport(
  deps: {
    native: () => boolean;
    direct: (question: TutorQuestion & { apiKey: string }) => Promise<string>;
    server: (
      url: string,
      body: object,
      signal: AbortSignal,
      native: boolean,
    ) => Promise<{ status: number; data: unknown }>;
  },
  timeoutMs = 60_000,
) {
  return async (
    settings: ConnectionSettings,
    question: TutorQuestion,
  ): Promise<string> => {
    if (question.signal?.aborted)
      throw new TutorError("O pedido foi interrompido.");
    const controller = new AbortController();
    const cancel = () => controller.abort(question.signal?.reason);
    question.signal?.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(
      () => controller.abort(new Error("timeout")),
      timeoutMs,
    );
    let abortListener: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      abortListener = () =>
        reject(
          new TutorError(
            "O pedido foi interrompido ou demorou demasiado. Tenta novamente.",
          ),
        );
      controller.signal.addEventListener("abort", abortListener, {
        once: true,
      });
    });
    if (question.signal?.aborted) cancel();
    try {
      ensureNotAborted(controller.signal);
      const work = async () => {
        if (settings.mode === "direct") {
          if (!settings.apiKey.trim())
            throw new TutorError(
              "Guarda a tua chave API nas Definições para usar o modo Esta app.",
            );
          return deps.direct({
            ...question,
            history: prepareHistory(question.history),
            apiKey: settings.apiKey.trim(),
            signal: controller.signal,
          });
        }
        const native = deps.native();
        if (native && !settings.serverUrl.trim())
          throw new TutorError(
            "Indica o teu servidor nas Definições ou escolhe o modo Esta app.",
          );
        const url = native
          ? serverEndpoint(settings.serverUrl, settings.allowLocalHttp)
          : "/api/chat";
        const response = await deps.server(
          url,
          {
            message: question.message,
            subject: question.subject,
            images: question.images,
            history: prepareHistory(question.history),
            clientVersion: 2,
          },
          controller.signal,
          native,
        );
        const data = response.data as {
          reply?: unknown;
          error?: unknown;
        } | null;
        if (response.status >= 400)
          throw new TutorError(
            typeof data?.error === "string"
              ? data.error
              : "O servidor não conseguiu responder. Confere as Definições.",
          );
        if (typeof data?.reply !== "string" || !data.reply.trim())
          throw new TutorError(
            "O servidor não enviou uma resposta válida. Tenta novamente.",
          );
        ensureNotAborted(controller.signal);
        return data.reply;
      };
      return await Promise.race([work(), aborted]);
    } finally {
      clearTimeout(timer);
      question.signal?.removeEventListener("abort", cancel);
      if (abortListener)
        controller.signal.removeEventListener("abort", abortListener);
    }
  };
}
