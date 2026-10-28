"use client";

import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  type Content,
  type Part,
} from "@google/genai";
import {
  buildSystemPrompt,
  MODEL,
  THINKING_LEVEL,
  type Subject,
} from "./prompt";
import {
  containsBlockedContent,
  outputIsInappropriate,
  SAFE_FALLBACK,
  GEMINI_KEY_PATTERN,
} from "./safety";
import {
  friendlyApiError,
  classifyApiError,
  apiErrorDiagnostic,
} from "./api-error";
import {
  generateWithNativeHttp,
  moderationCheckNativeHttp,
  isNativeHttpAvailable,
  normalizeNativeError,
} from "./gemini-http";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  MAX_MESSAGE_LENGTH,
  MAX_OUTPUT_TOKENS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  type ChatImage,
  type ChatMessage,
} from "./shared";

import { TutorError, ensureNotAborted } from "./tutor-error";
export { TutorError } from "./tutor-error";
import { prepareHistory } from "./history";
import { moderate, MODERATION_UNAVAILABLE } from "./moderation";

const clients = new Map<string, GoogleGenAI>();
export function clearDirectClients() {
  clients.clear();
}

function getClient(apiKey: string): GoogleGenAI {
  let client = clients.get(apiKey);
  if (!client) {
    client = new GoogleGenAI({ apiKey });
    clients.set(apiKey, client);
  }
  return client;
}

const localRequests: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  const recent = localRequests.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  localRequests.length = 0;
  localRequests.push(...recent);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) return true;
  localRequests.push(now);
  return false;
}

function isValidImage(img: ChatImage): boolean {
  if (!img || typeof img.mimeType !== "string" || typeof img.data !== "string")
    return false;
  if (!["image/jpeg", "image/png", "image/webp"].includes(img.mimeType))
    return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(img.data)) return false;
  return Math.ceil((img.data.length * 3) / 4) <= MAX_IMAGE_BYTES;
}

function buildContents(
  history: ChatMessage[],
  message: string,
  images: ChatImage[],
): Content[] {
  // prepareHistory: so texto, ultimas MAX_HISTORY_MESSAGES, comeca em "user".
  // As imagens do historico nao sao reenviadas (evita pedidos enormes).
  const past = prepareHistory(history).map((m): Content => ({
    role: m.role,
    parts: [{ text: m.text } as Part],
  }));

  const userParts: Part[] = [{ text: message } as Part];
  for (const img of images) {
    userParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }

  return [...past, { role: "user", parts: userParts }];
}

async function moderationCheck(client: GoogleGenAI, text: string) {
  return moderate(text, async (prompt, abortSignal) => {
    const res = await client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        abortSignal,
        thinkingConfig: { thinkingLevel: "LOW" as never },
        maxOutputTokens: 32,
      },
    });
    return res.text ?? "";
  });
}

export async function askTutorDirect(params: {
  apiKey: string;
  message: string;
  history: ChatMessage[];
  subject: Subject;
  images: ChatImage[];
  signal?: AbortSignal;
}): Promise<string> {
  const { apiKey, message, history, subject, images } = params;

  if (!GEMINI_KEY_PATTERN.test(apiKey)) {
    throw new TutorError(
      "A chave API guardada n\u00e3o parece v\u00e1lida. Confere nas Defini\u00e7\u00f5es. \u2699\ufe0f",
    );
  }
  if (isRateLimited()) {
    throw new TutorError(
      "Muitas mensagens por minuto. Aguarde um pouquinho e tente de novo. \ud83d\ude0a",
    );
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new TutorError(
      `Sua mensagem \u00e9 muito longa. M\u00e1ximo de ${MAX_MESSAGE_LENGTH} caracteres.`,
    );
  }
  if (message.trim().length > 0 && containsBlockedContent(message)) {
    throw new TutorError(
      "Esse assunto n\u00e3o posso ajudar. Vamos voltar para os estudos? \ud83d\udcda",
    );
  }
  if (images.length > MAX_IMAGES_PER_MESSAGE) {
    throw new TutorError(
      `Voc\u00ea pode enviar no m\u00e1ximo ${MAX_IMAGES_PER_MESSAGE} fotos por vez.`,
    );
  }
  if (!images.every(isValidImage)) {
    throw new TutorError(
      "Imagem inv\u00e1lida. Envie fotos em JPEG, PNG ou WebP de at\u00e9 4 MB.",
    );
  }

  // Android usa HTTP nativo; uma falha não altera o transporte escolhido.
  let text: string | null = null;

  if (isNativeHttpAvailable()) {
    try {
      text = await generateWithNativeHttp({
        apiKey,
        message,
        history,
        subject,
        images,
      });
      if (!text) {
        return "N\u00e3o consegui ver direito essa foto. Tenta tirar outra com mais luz e mais de perto? \ud83d\udcf8";
      }
    } catch (err) {
      // Preservar status HTTP e o código nativo das falhas de transporte.
      if (err instanceof TutorError) throw err;
      const normalized = normalizeNativeError(err);
      throw new TutorError(
        friendlyApiError(normalized),
        classifyApiError(normalized),
        apiErrorDiagnostic(normalized),
      );
    }
  }

  try {
    if (text === null) {
      // O browser usa o SDK da Google.
      const client = getClient(apiKey);
      const response = await client.models.generateContent({
        model: MODEL,
        contents: buildContents(history, message, images),
        config: {
          abortSignal: params.signal,
          systemInstruction: buildSystemPrompt(subject),
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          thinkingConfig: {
            thinkingLevel: THINKING_LEVEL as never,
            includeThoughts: false,
          },
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
          ],
        },
      });
      const sdkText = response.text ?? null;
      if (!sdkText) {
        return "Não consegui ver direito essa foto. Tenta tirar outra com mais luz e mais de perto? 📸";
      }
      text = sdkText;
    }

    ensureNotAborted(params.signal);
    if (outputIsInappropriate(text)) {
      return SAFE_FALLBACK;
    }

    const isSafe = isNativeHttpAvailable()
      ? await moderationCheckNativeHttp(apiKey, text)
      : await moderationCheck(getClient(apiKey), text);
    if (isSafe === "unavailable")
      throw new TutorError(
        MODERATION_UNAVAILABLE,
        undefined,
        "MODERATION_UNAVAILABLE",
      );
    if (isSafe === "rejected") {
      return SAFE_FALLBACK;
    }

    ensureNotAborted(params.signal);
    return text;
  } catch (error) {
    if (error instanceof TutorError) throw error;
    // Traduz o erro real (chave invalida, quota, rede, bloqueio) numa mensagem clara.
    throw new TutorError(
      friendlyApiError(error),
      classifyApiError(error),
      apiErrorDiagnostic(error),
    );
  }
}
