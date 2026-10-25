"use client";

import { GoogleGenAI, HarmBlockThreshold, HarmCategory, type Content, type Part } from "@google/genai";
import { buildSystemPrompt, MODEL, THINKING_LEVEL, type Subject } from "./prompt";
import {
  containsBlockedContent,
  outputIsInappropriate,
  SAFE_FALLBACK,
  GEMINI_KEY_PATTERN,
} from "./safety";
import { friendlyApiError } from "./api-error";
import { generateWithNativeHttp, moderationCheckNativeHttp, isNativeHttpAvailable } from "./gemini-http";
import {
  MAX_HISTORY_MESSAGES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_MESSAGE,
  MAX_MESSAGE_LENGTH,
  MAX_OUTPUT_TOKENS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  type ChatImage,
  type ChatMessage,
} from "./shared";

export class TutorError extends Error {}

const clients = new Map<string, GoogleGenAI>();

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
  if (!img || typeof img.mimeType !== "string" || typeof img.data !== "string") return false;
  if (!["image/jpeg", "image/png", "image/webp"].includes(img.mimeType)) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(img.data)) return false;
  return Math.ceil((img.data.length * 3) / 4) <= MAX_IMAGE_BYTES;
}

function buildContents(history: ChatMessage[], message: string, images: ChatImage[]): Content[] {
  const past = history
    .filter((m) => (m.role === "user" || m.role === "model") && typeof m.text === "string")
    .slice(-MAX_HISTORY_MESSAGES)
    .map(
      (m): Content => ({
        role: m.role,
        parts: [
          { text: m.text } as Part,
          ...(m.images ?? [])
            .filter(isValidImage)
            .slice(0, MAX_IMAGES_PER_MESSAGE)
            .map((img): Part => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
        ],
      })
    );

  const userParts: Part[] = [{ text: message } as Part];
  for (const img of images) {
    userParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }

  return [...past, { role: "user", parts: userParts }];
}

async function moderationCheck(client: GoogleGenAI, text: string): Promise<boolean> {
  const prompt = `Avalia se o TEXTO abaixo \u00e9 adequado para uma crian\u00e7a de 12 anos (sem viol\u00eancia, sexo, \u00f3dio, drogas ou instru\u00e7\u00f5es perigosas). Responde apenas com a palavra SIM ou NAO.

TEXTO:
"""
${text.slice(0, 2000)}
"""`;

  // 1 retry antes de desistir (falhas de rede transitórias no telemóvel)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: "LOW" as never },
          maxOutputTokens: 16,
        },
      });
      return (res.text ?? "").trim().toUpperCase().startsWith("SIM");
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  return true;
}

export async function askTutorDirect(params: {
  apiKey: string;
  message: string;
  history: ChatMessage[];
  subject: Subject;
  images: ChatImage[];
}): Promise<string> {
  const { apiKey, message, history, subject, images } = params;

  if (!GEMINI_KEY_PATTERN.test(apiKey)) {
    throw new TutorError("A chave API guardada n\u00e3o parece v\u00e1lida. Confere nas Defini\u00e7\u00f5es. \u2699\ufe0f");
  }
  if (isRateLimited()) {
    throw new TutorError("Muitas mensagens por minuto. Aguarde um pouquinho e tente de novo. \ud83d\ude0a");
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new TutorError(`Sua mensagem \u00e9 muito longa. M\u00e1ximo de ${MAX_MESSAGE_LENGTH} caracteres.`);
  }
  if (message.trim().length > 0 && containsBlockedContent(message)) {
    throw new TutorError("Esse assunto n\u00e3o posso ajudar. Vamos voltar para os estudos? \ud83d\udcda");
  }
  if (images.length > MAX_IMAGES_PER_MESSAGE) {
    throw new TutorError(`Voc\u00ea pode enviar no m\u00e1ximo ${MAX_IMAGES_PER_MESSAGE} fotos por vez.`);
  }
  if (!images.every(isValidImage)) {
    throw new TutorError("Imagem inv\u00e1lida. Envie fotos em JPEG, PNG ou WebP de at\u00e9 4 MB.");
  }

  // Na app Android, tenta primeiro o HTTP nativo (OkHttp) — dá o erro HTTP real
  // e não sofre com restrições do WebView. Se falhar por rede, faz fallback para o SDK.
  let text: string | null = null;
  let lastError: unknown = null;

  if (isNativeHttpAvailable()) {
    try {
      text = await generateWithNativeHttp({ apiKey, message, history, subject, images });
      if (!text) {
        return "N\u00e3o consegui ver direito essa foto. Tenta tirar outra com mais luz e mais de perto? \ud83d\udcf8";
      }
    } catch (err) {
      lastError = err;
      // Se for erro de rede (sem status HTTP), tenta o SDK como fallback
      const status = (err as { status?: number })?.status;
      if (status !== undefined) throw err; // erro real da API (401/429/...) — não vale a pena repetir
      // else: cai para o SDK abaixo
    }
  }

  try {
    if (text === null) {
      // Fallback: SDK (fetch do WebView) — só quando o HTTP nativo não está disponível
      // ou falhou por rede (sem status HTTP real).
      const client = getClient(apiKey);
      let sdkText: string | null = null;
      try {
        const response = await client.models.generateContent({
          model: MODEL,
          contents: buildContents(history, message, images),
          config: {
            systemInstruction: buildSystemPrompt(subject),
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            thinkingConfig: {
              thinkingLevel: THINKING_LEVEL as never,
              includeThoughts: false,
            },
            safetySettings: [
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
              { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            ],
          },
        });
        sdkText = response.text ?? null;
      } catch (sdkError) {
        // Se o HTTP nativo já deu um erro real, esse é o que interessa
        throw lastError ?? sdkError;
      }
      if (!sdkText) {
        return "Não consegui ver direito essa foto. Tenta tirar outra com mais luz e mais de perto? 📸";
      }
      text = sdkText;
    }

    if (outputIsInappropriate(text)) {
      return SAFE_FALLBACK;
    }

    const isSafe = isNativeHttpAvailable()
      ? await moderationCheckNativeHttp(apiKey, text)
      : await moderationCheck(getClient(apiKey), text);
    if (!isSafe) {
      return SAFE_FALLBACK;
    }

    return text;
    } catch (error) {
    if (error instanceof TutorError) throw error;
    // Traduz o erro real (chave invalida, quota, rede, bloqueio) numa mensagem clara.
    throw new TutorError(friendlyApiError(error));
  }
}
