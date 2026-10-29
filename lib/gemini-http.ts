"use client";

import { CapacitorHttp, type HttpResponse } from "@capacitor/core";
import {
  MODEL,
  THINKING_LEVEL,
  buildSystemPrompt,
  type Subject,
} from "./prompt";
import { MAX_OUTPUT_TOKENS, type ChatImage, type ChatMessage } from "./shared";
import { TutorError } from "./tutor-error";

/**
 * Chamada direta à Gemini via HTTP nativo do Capacitor (OkHttp no Android).
 *
 * Porquê: o WebView do Android (fetch do browser) pode falhar em cenários que o
 * HTTP nativo não tem (TLS, políticas de rede, cleartext), e dá-nos o código HTTP
 * real da resposta — para erros honestos em vez de "sem internet" falso.
 *
 * No browser (PWA), CapacitorHttp faz fallback para fetch — continua a funcionar.
 */

function isNative(): boolean {
  return (
    typeof window !== "undefined" &&
    // @ts-expect-error Capacitor injeta este objeto na app nativa
    !!window.Capacitor?.isNativePlatform?.()
  );
}

import { prepareHistory } from "./history";
export { prepareHistory } from "./history";
import { moderate } from "./moderation";
import { modelName } from "./model-config";

export function buildGeminiBody(params: {
  message: string;
  history: ChatMessage[];
  subject: Subject;
  images: ChatImage[];
}): Record<string, unknown> {
  const { message, history, subject, images } = params;

  const contents = [
    ...prepareHistory(history).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    {
      role: "user",
      parts: [
        { text: message },
        ...images.map((img) => ({
          inlineData: { mimeType: img.mimeType, data: img.data },
        })),
      ],
    },
  ];

  return {
    contents,
    systemInstruction: { parts: [{ text: buildSystemPrompt(subject) }] },
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      thinkingConfig: { thinkingLevel: THINKING_LEVEL, includeThoughts: false },
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_LOW_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_ONLY_HIGH",
      },
      {
        category: "HARM_CATEGORY_CIVIC_INTEGRITY",
        threshold: "BLOCK_ONLY_HIGH",
      },
    ],
  };
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; status?: string; message?: string };
};

async function callGeminiRaw(
  apiKey: string,
  body: Record<string, unknown>,
  timeout = 55_000,
  model = MODEL,
): Promise<GeminiResponse> {
  const res: HttpResponse = await CapacitorHttp.request({
    url: `https://generativelanguage.googleapis.com/v1beta/models/${modelName(model)}:generateContent`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    data: body,
    connectTimeout: Math.min(20_000, timeout),
    readTimeout: timeout,
    responseType: "json",
    disableRedirects: true,
  });

  // Erro HTTP real (401 chave, 429 quota, 503, etc.) — devolve o body para classificação
  if (res.status >= 400) {
    throw makeApiError(res.status, res.data);
  }

  return res.data as GeminiResponse;
}

/**
 * Cria um erro com .status (HTTP) e .message = JSON do body, no mesmo formato
 * do ApiError do SDK — para o classificador (lib/api-error.ts) funcionar igual.
 */
export function makeApiError(
  status: number,
  data: unknown,
): Error & { status: number; responseFormat: "JSON" | "TEXT" } {
  const message = typeof data === "string" ? data : JSON.stringify(data);
  const err = new Error(message) as Error & {
    status: number;
    responseFormat: "JSON" | "TEXT";
  };
  err.status = status;
  err.responseFormat = "TEXT";
  try {
    const parsed: unknown = typeof data === "string" ? JSON.parse(data) : data;
    if (parsed !== null && typeof parsed === "object")
      err.responseFormat = "JSON";
  } catch {
    // A referência pode indicar texto/HTML, mas nunca apresenta o corpo recebido.
  }
  return err;
}

/**
 * Normaliza erros vindos do CapacitorHttp nativo (Android).
 * Respostas HTTP normais conservam status/data. Exceções de transporte incluem
 * o código da exceção Java, necessário para distinguir DNS, TLS e timeout.
 */
export function normalizeNativeError(
  error: unknown,
): Error & { status?: number; code?: string } {
  const value = error as {
    message?: unknown;
    name?: unknown;
    code?: unknown;
    status?: unknown;
  } | null;
  const message =
    typeof value?.message === "string"
      ? value.message
      : typeof error === "string"
        ? error
        : "";
  // Não confundir números de portas, endereços ou timeouts com status HTTP.
  const match = message.match(
    /(?:status code\s*[:=]?\s*|HTTP(?:\/\d(?:\.\d)?)?\s+)([1-5]\d{2})\b/i,
  );
  const status =
    typeof value?.status === "number" &&
    Number.isInteger(value.status) &&
    value.status >= 100 &&
    value.status <= 599
      ? value.status
      : match
        ? parseInt(match[1], 10)
        : undefined;
  const err =
    error instanceof Error
      ? (error as Error & { status?: number; code?: string })
      : (new Error(message) as Error & { status?: number; code?: string });
  if (typeof value?.name === "string") err.name = value.name;
  if (typeof value?.code === "string") err.code = value.code;
  if (
    err.status !== undefined &&
    (!Number.isInteger(err.status) || err.status < 100 || err.status > 599)
  )
    delete err.status;
  if (status !== undefined) err.status = status;
  return err;
}

export function isNativeHttpAvailable(): boolean {
  return isNative();
}

export async function generateWithNativeHttp(params: {
  apiKey: string;
  message: string;
  history: ChatMessage[];
  subject: Subject;
  images: ChatImage[];
  model?: string;
}): Promise<string | null> {
  const body = buildGeminiBody(params);
  const json = await callGeminiRaw(params.apiKey, body, 55_000, params.model);

  if (json.promptFeedback?.blockReason) {
    throw new TutorError(
      "A tua pergunta foi bloqueada pelos filtros de segurança. Tenta perguntar de outra forma, sobre as tuas matérias. 📚",
    );
  }

  const text =
    json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
    "";
  if (!text) return null;
  return text;
}

export async function moderationCheckNativeHttp(
  apiKey: string,
  text: string,
  model = MODEL,
) {
  return moderate(text, async (prompt) => {
    const json = await callGeminiRaw(
      apiKey,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 32,
          thinkingConfig: { thinkingLevel: "LOW", includeThoughts: false },
        },
      },
      14_000,
      model,
    );
    return (
      json.candidates?.[0]?.content?.parts
        ?.filter((p) => !(p as { thought?: boolean }).thought)
        .map((p) => p.text ?? "")
        .join("") ?? ""
    );
  });
}
