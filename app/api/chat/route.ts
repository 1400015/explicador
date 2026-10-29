import { NextRequest, NextResponse } from "next/server";
import { getAi, buildSystemPrompt, serverModelConfig } from "@/lib/gemini";
import { outputIsInappropriate, SAFE_FALLBACK } from "@/lib/safety";
import {
  apiErrorDiagnostic,
  classifyApiError,
  friendlyApiError,
} from "@/lib/api-error";
import {
  availabilityDiagnostic,
  requestWithAvailability,
  GENERATION_ATTEMPT_TIMEOUT_MS,
} from "@/lib/gemini-availability";
import { ChatRequestError, readChatRequest } from "@/lib/chat-request";
import { moderate, MODERATION_UNAVAILABLE } from "@/lib/moderation";
import { TutorError } from "@/lib/tutor-error";
import {
  MAX_OUTPUT_TOKENS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "@/lib/shared";
import {
  Content,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  Part,
} from "@google/genai";

// Clientes Gemini por chave enviada pela app (modo "servidor" com chave do utilizador).
// Cache limitado para não acumular clientes em memória.
const directClients = new Map<string, GoogleGenAI>();
const MAX_CACHED_CLIENTS = 10;

function getClientForKey(apiKey: string): GoogleGenAI {
  let client = directClients.get(apiKey);
  if (!client) {
    if (directClients.size >= MAX_CACHED_CLIENTS) {
      const oldest = directClients.keys().next().value;
      if (oldest !== undefined) directClients.delete(oldest);
    }
    client = new GoogleGenAI({ apiKey });
    directClients.set(apiKey, client);
  }
  return client;
}

const requestsByIp = new Map<string, number[]>();
const MAX_TRACKED_IPS = 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestsByIp.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestsByIp.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  requestsByIp.set(ip, timestamps);

  // Limpa IPs inativos para o Map não crescer sem limite.
  if (requestsByIp.size > MAX_TRACKED_IPS) {
    for (const [key, ts] of requestsByIp) {
      if (ts.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) {
        requestsByIp.delete(key);
      }
    }
  }
  return false;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      {
        error:
          "Muitas mensagens por minuto. Aguarde um pouquinho e tente de novo. 🚊",
      },
      { status: 429 },
    );
  }

  let input;
  try {
    input = await readChatRequest(request);
  } catch (error) {
    const status = error instanceof ChatRequestError ? error.status : 400;
    return NextResponse.json(
      {
        error:
          error instanceof ChatRequestError
            ? error.message
            : "Corpo da requisição inválido.",
      },
      { status },
    );
  }
  const {
    message,
    subject: validSubject,
    images: newImages,
    history: chatHistory,
    apiKey,
  } = input;
  if (apiKey && process.env.GEMINI_ALLOW_LEGACY_KEYS !== "1") {
    return NextResponse.json(
      {
        error:
          "Atualiza a aplicação: no modo Esta app a chave é usada diretamente na Google. O servidor usa a sua própria chave.",
      },
      { status: 400 },
    );
  }
  let client: GoogleGenAI;
  let modelConfig: ReturnType<typeof serverModelConfig>;
  try {
    modelConfig = serverModelConfig();
    client = apiKey ? getClientForKey(apiKey) : getAi();
  } catch {
    return NextResponse.json(
      {
        error:
          "Não foi possível iniciar a IA do servidor. Confere a chave, o modelo e o raciocínio configurados. ⚙️",
      },
      { status: 503 },
    );
  }

  const userParts: Part[] = [{ text: message } as Part];
  for (const img of newImages) {
    userParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }

  const contents: Content[] = [
    ...chatHistory.map((m): Content => ({
      role: m.role,
      parts: [{ text: m.text } as Part],
    })),
    { role: "user", parts: userParts },
  ];

  let usedModel = modelConfig.model;
  let generationComplete = false;
  try {
    const response = await requestWithAvailability(
      (model, attemptSignal) => {
        usedModel = model;
        return client.models.generateContent({
          model,
          contents,
          config: {
            abortSignal: attemptSignal,
            httpOptions: { timeout: GENERATION_ATTEMPT_TIMEOUT_MS },
            systemInstruction: buildSystemPrompt(validSubject),
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            thinkingConfig: {
              thinkingLevel: modelConfig.thinking as never,
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
      },
      modelConfig.model,
      modelConfig.fallback,
      request.signal,
    );
    generationComplete = true;

    const text = response.text;

    if (!text) {
      return NextResponse.json({
        reply:
          "Não consegui ver direito essa foto. Tenta tirar outra com mais luz e mais de perto? 📸",
      });
    }

    // 2.ª camada: filtro de saída no servidor
    if (outputIsInappropriate(text)) {
      console.warn("Filtro de saída bloqueou resposta inadequada");
      return NextResponse.json({ reply: SAFE_FALLBACK });
    }

    // 3.ª camada: verificação de moderação pela própria IA
    const isSafe = await moderate(text, async (prompt, abortSignal) => {
      const result = await client.models.generateContent({
        model: usedModel,
        contents: prompt,
        config: {
          abortSignal,
          httpOptions: { timeout: 14_000 },
          thinkingConfig: { thinkingLevel: "LOW" as never },
          maxOutputTokens: 512,
        },
      });
      return result.text ?? "";
    });
    if (isSafe === "unavailable")
      return NextResponse.json(
        { error: MODERATION_UNAVAILABLE },
        { status: 503 },
      );
    if (isSafe === "rejected")
      return NextResponse.json({ reply: SAFE_FALLBACK });

    return NextResponse.json({ reply: text });
  } catch (error) {
    const diagnostic = generationComplete
      ? undefined
      : (availabilityDiagnostic(error) ??
        `${usedModel}:${apiErrorDiagnostic(error)}`);
    const reference = diagnostic ? ` Referência: ${diagnostic}.` : "";
    if (error instanceof TutorError)
      return NextResponse.json(
        { error: error.message + reference },
        { status: 503 },
      );
    console.error("Erro na API do Gemini:", classifyApiError(error));
    // Devolve a causa real (chave invalida, quota, bloqueio, rede) em vez de erro generico.
    const kind = classifyApiError(error);
    const status =
      kind === "invalid-key"
        ? 401
        : kind === "quota"
          ? 429
          : kind === "blocked" || kind === "invalid-request"
            ? 400
            : kind === "too-large"
              ? 413
              : 500;
    return NextResponse.json(
      { error: friendlyApiError(error) + reference },
      { status },
    );
  }
}
