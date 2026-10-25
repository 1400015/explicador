import { NextRequest, NextResponse } from "next/server";
import { getAi, buildSystemPrompt, MODEL, THINKING_LEVEL, Subject, SUBJECT_LABELS } from "@/lib/gemini";
import {
  containsBlockedContent,
  outputIsInappropriate,
  SAFE_FALLBACK,
  GEMINI_KEY_PATTERN,
} from "@/lib/safety";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_HISTORY_MESSAGES,
  MAX_IMAGES_PER_MESSAGE,
  MAX_IMAGE_BYTES,
  MAX_MESSAGE_LENGTH,
  MAX_OUTPUT_TOKENS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  type ChatImage,
  type ChatMessage,
} from "@/lib/shared";
import { Content, GoogleGenAI, HarmBlockThreshold, HarmCategory, Part } from "@google/genai";

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
    (t) => now - t < RATE_LIMIT_WINDOW_MS
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

// 3.ª camada: a própria IA verifica se a resposta é adequada para 12 anos.
async function moderationCheck(client: GoogleGenAI, text: string): Promise<boolean> {
  const prompt = `Avalia se o TEXTO abaixo é adequado para uma criança de 12 anos (sem violência, sexo, ódio, drogas ou instruções perigosas). Responde apenas com a palavra SIM ou NAO.

TEXTO:
"""
${text.slice(0, 2000)}
"""`;

  // 1 retry antes de desistir (falhas de rede transitórias)
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
    } catch (err) {
      if (attempt === 0) {
        console.warn("Moderação falhou (1ª tentativa), tentando de novo:", err instanceof Error ? err.message : err);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        // se a moderação continuar a falhar, deixamos passar (as outras 2 camadas já atuaram)
        console.warn("Moderação falhou nas 2 tentativas; resposta passa pelas camadas 1 e 2");
      }
    }
  }
  return true;
}

function isValidImage(img: unknown): img is ChatImage {
  if (typeof img !== "object" || img === null) return false;
  const { mimeType, data } = img as Record<string, unknown>;
  if (typeof mimeType !== "string" || typeof data !== "string") return false;
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimeType)) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return false;
  const approxBytes = Math.ceil((data.length * 3) / 4);
  return approxBytes <= MAX_IMAGE_BYTES;
}

const VALID_SUBJECTS = Object.keys(SUBJECT_LABELS) as Subject[];

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Muitas mensagens por minuto. Aguarde um pouquinho e tente de novo. 🚊" },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const { message, history, subject, images, apiKey } = body as {
    message?: unknown;
    history?: unknown;
    subject?: unknown;
    images?: unknown;
    apiKey?: unknown;
  };

  let client: GoogleGenAI;
  if (typeof apiKey === "string" && apiKey.length > 0) {
    // A app envia a chave guardada no telemóvel (modo "servidor" com chave própria).
    // Todas as proteções abaixo (rate limit, filtros, safety settings) continuam ativas.
    if (!GEMINI_KEY_PATTERN.test(apiKey)) {
      return NextResponse.json(
        { error: "A chave API guardada não parece válida. Confere nas Definições. ⚙️" },
        { status: 400 }
      );
    }
    client = getClientForKey(apiKey);
  } else {
    try {
      client = getAi();
    } catch {
      return NextResponse.json(
        { error: "O servidor não tem chave configurada. Guarda a tua chave nas Definições da app. ⚙️" },
        { status: 500 }
      );
    }
  }

  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Envie uma pergunta ou uma foto. 📸" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Sua mensagem é muito longa. Máximo de ${MAX_MESSAGE_LENGTH} caracteres.` },
      { status: 400 }
    );
  }
  if (containsBlockedContent(message)) {
    return NextResponse.json(
      { error: "Esse assunto não posso ajudar. Vamos voltar para os estudos? 📚" },
      { status: 400 }
    );
  }

  let newImages: ChatImage[] = [];
  if (images !== undefined) {
    if (!Array.isArray(images) || images.length > MAX_IMAGES_PER_MESSAGE) {
      return NextResponse.json(
        { error: `Você pode enviar no máximo ${MAX_IMAGES_PER_MESSAGE} fotos por vez.` },
        { status: 400 }
      );
    }
    if (images.length > 0 && message.trim().length === 0) {
      return NextResponse.json({ error: "Envie uma pergunta ou uma foto. 📸" }, { status: 400 });
    }
    for (const img of images) {
      if (!isValidImage(img)) {
        return NextResponse.json(
          { error: "Imagem inválida. Envie fotos em JPEG, PNG ou WebP de até 4 MB." },
          { status: 400 }
        );
      }
    }
    newImages = images as ChatImage[];
  }

  const validSubject: Subject = VALID_SUBJECTS.includes(subject as Subject)
    ? (subject as Subject)
    : "geral";

  let chatHistory: ChatMessage[] = [];
  if (Array.isArray(history)) {
    chatHistory = history
      .filter((m): m is ChatMessage => {
        if (typeof m !== "object" || m === null) return false;
        const msg = m as Record<string, unknown>;
        if (msg.role !== "user" && msg.role !== "model") return false;
        if (typeof msg.text !== "string" || msg.text.length > MAX_MESSAGE_LENGTH) return false;
        if (msg.images === undefined) return true;
        if (!Array.isArray(msg.images) || msg.images.length > MAX_IMAGES_PER_MESSAGE) return false;
        return msg.images.every(isValidImage);
      })
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({
        role: m.role,
        text: m.text,
        images: (m.images as ChatImage[] | undefined)?.slice(0, MAX_IMAGES_PER_MESSAGE),
      }));
  }

  const userParts: Part[] = [{ text: message } as Part];
  for (const img of newImages) {
    userParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }

  const contents: Content[] = [
    ...chatHistory.map((m): Content => ({
      role: m.role,
      parts: [
        { text: m.text } as Part,
        ...(m.images ?? []).map(
          (img): Part => ({ inlineData: { mimeType: img.mimeType, data: img.data } })
        ),
      ],
    })),
    { role: "user", parts: userParts },
  ];

  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: buildSystemPrompt(validSubject),
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

    const text = response.text;

    if (!text) {
      return NextResponse.json({
        reply: "Não consegui ver direito essa foto. Tenta tirar outra com mais luz e mais de perto? 📸",
      });
    }

    // 2.ª camada: filtro de saída no servidor
    if (outputIsInappropriate(text)) {
      console.warn("Filtro de saída bloqueou resposta inadequada");
      return NextResponse.json({ reply: SAFE_FALLBACK });
    }

    // 3.ª camada: verificação de moderação pela própria IA
    const isSafe = await moderationCheck(client, text);
    if (!isSafe) {
      console.warn("Moderação bloqueou resposta inadequada");
      return NextResponse.json({ reply: SAFE_FALLBACK });
    }

    return NextResponse.json({ reply: text });
  } catch (error) {
    console.error("Erro na API do Gemini:", error);
    return NextResponse.json(
      { error: "Tive um probleminha para responder. Tenta de novo daqui a pouco? 🤏" },
      { status: 500 }
    );
  }
}
