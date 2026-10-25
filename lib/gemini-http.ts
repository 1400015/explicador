"use client";

import { CapacitorHttp, type HttpResponse } from "@capacitor/core";
import { MODEL, THINKING_LEVEL, buildSystemPrompt, type Subject } from "./prompt";
import { MAX_OUTPUT_TOKENS, type ChatImage, type ChatMessage } from "./shared";
import { TutorError } from "./gemini-client";

/**
 * Chamada direta à Gemini via HTTP nativo do Capacitor (OkHttp no Android).
 *
 * Porquê: o WebView do Android (fetch do browser) pode falhar em cenários que o
 * HTTP nativo não tem (TLS, políticas de rede, cleartext), e dá-nos o código HTTP
 * real da resposta — para erros honestos em vez de "sem internet" falso.
 *
 * No browser (PWA), CapacitorHttp faz fallback para fetch — continua a funcionar.
 */

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function isNative(): boolean {
  return (
    typeof window !== "undefined" &&
    // @ts-expect-error Capacitor injeta este objeto na app nativa
    !!window.Capacitor?.isNativePlatform?.()
  );
}

function buildGeminiBody(params: {
  message: string;
  history: ChatMessage[];
  subject: Subject;
  images: ChatImage[];
}): Record<string, unknown> {
  const { message, history, subject, images } = params;

  const contents = [
    ...history.slice(-20).map((m) => ({
      role: m.role,
      parts: [
        { text: m.text },
        ...(m.images ?? []).map((img) => ({
          inlineData: { mimeType: img.mimeType, data: img.data },
        })),
      ],
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
      { category: "HARM_CATEGORY_HARASSMENT", blockThreshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", blockThreshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", blockThreshold: "BLOCK_LOW_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", blockThreshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_CIVIC_INTEGRITY", blockThreshold: "BLOCK_ONLY_HIGH" },
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

async function callGeminiRaw(apiKey: string, body: Record<string, unknown>): Promise<GeminiResponse> {
  const res: HttpResponse = await CapacitorHttp.request({
    url: ENDPOINT,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    data: body,
    connectTimeout: 20_000,
    readTimeout: 60_000,
    responseType: "json",
  });

  // Erro HTTP real (401 chave, 429 quota, 503, etc.) — devolve o body para classificação
  if (res.status >= 400) {
    const err = new Error(
      typeof res.data === "string" ? res.data : JSON.stringify(res.data)
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return res.data as GeminiResponse;
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
}): Promise<string | null> {
  const body = buildGeminiBody(params);
  const json = await callGeminiRaw(params.apiKey, body);

  if (json.promptFeedback?.blockReason) {
    throw new TutorError(
      "A tua pergunta foi bloqueada pelos filtros de segurança. Tenta perguntar de outra forma, sobre as tuas matérias. 📚"
    );
  }

  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) return null;
  return text;
}

// Moderação: segunda chamada (thinking LOW, máx 16 tokens) para julgar adequação.
export async function moderationCheckNativeHttp(apiKey: string, text: string): Promise<boolean> {
  const prompt = `Avalia se o TEXTO abaixo é adequado para uma criança de 12 anos (sem violência, sexo, ódio, drogas ou instruções perigosas). Responde apenas com a palavra SIM ou NAO.

TEXTO:
"""
${text.slice(0, 2000)}
"""`;

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 16,
      thinkingConfig: { thinkingLevel: "LOW", includeThoughts: false },
    },
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const json = await callGeminiRaw(apiKey, body);
      const answer = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      return answer.trim().toUpperCase().startsWith("SIM");
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  return true; // se a moderação falhar, deixam passar as outras camadas
}
