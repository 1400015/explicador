import { prepareHistory } from "./history";
import { SUBJECT_LABELS, type Subject } from "./prompt";
import { GEMINI_KEY_PATTERN, containsBlockedContent } from "./safety";
import {
  isLearningProfile,
  learningProfile,
  LEGACY_PROFILE,
} from "./learning-profile";
import { readPhotoContext } from "./photo-context";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGES_PER_MESSAGE,
  MAX_IMAGE_BYTES,
  MAX_MESSAGE_LENGTH,
  type ChatImage,
  type ChatMessage,
} from "./shared";

export const MAX_REQUEST_BYTES = 24 * 1024 * 1024;
export const MAX_HISTORY_TEXT_LENGTH = 8000;
export class ChatRequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function validateChatRequest(body: unknown) {
  if (!record(body))
    throw new ChatRequestError("Corpo da requisição inválido.");
  const {
    message,
    history = [],
    subject = "geral",
    images = [],
    apiKey,
  } = body;
  if (body.profile !== undefined && !isLearningProfile(body.profile))
    throw new ChatRequestError("Perfil de idioma e ensino inválido.");
  const photoContext =
    body.photoContext === undefined
      ? null
      : readPhotoContext(body.photoContext);
  if (body.photoContext !== undefined && !photoContext)
    throw new ChatRequestError(
      "Contexto das fotografias inválido ou demasiado longo.",
    );
  if (typeof message !== "string" || !message.trim())
    throw new ChatRequestError("Envie uma pergunta ou uma foto. 📸");
  if (message.length > MAX_MESSAGE_LENGTH)
    throw new ChatRequestError(
      `Máximo de ${MAX_MESSAGE_LENGTH} caracteres por pergunta.`,
    );
  if (containsBlockedContent(message))
    throw new ChatRequestError(
      "Esse assunto não posso ajudar. Vamos voltar para os estudos? 📚",
    );
  if (typeof subject !== "string" || !Object.hasOwn(SUBJECT_LABELS, subject))
    throw new ChatRequestError("Matéria inválida.");
  if (
    apiKey !== undefined &&
    (typeof apiKey !== "string" ||
      (apiKey !== "" && !GEMINI_KEY_PATTERN.test(apiKey)))
  )
    throw new ChatRequestError(
      "A chave API guardada não parece válida. Confere nas Definições. ⚙️",
    );
  if (!Array.isArray(history) || history.length > 100)
    throw new ChatRequestError("Histórico inválido ou demasiado longo.");
  if (
    !history.every(
      (m) =>
        record(m) &&
        (m.role === "user" || m.role === "model") &&
        typeof m.text === "string" &&
        m.text.length <= MAX_HISTORY_TEXT_LENGTH,
    )
  )
    throw new ChatRequestError("Mensagem do histórico inválida.");
  if (!Array.isArray(images) || images.length > MAX_IMAGES_PER_MESSAGE)
    throw new ChatRequestError(
      `Máximo de ${MAX_IMAGES_PER_MESSAGE} fotos por mensagem.`,
    );
  for (const img of images) {
    if (
      !record(img) ||
      typeof img.mimeType !== "string" ||
      !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(img.mimeType) ||
      typeof img.data !== "string" ||
      img.data.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(img.data)
    )
      throw new ChatRequestError("Imagem inválida. Envie JPEG, PNG ou WebP.");
    const bytes =
      (img.data.length * 3) / 4 -
      (img.data.endsWith("==") ? 2 : img.data.endsWith("=") ? 1 : 0);
    if (bytes > MAX_IMAGE_BYTES)
      throw new ChatRequestError("Máximo de 4 MB por foto.", 413);
  }
  return {
    message,
    subject: subject as Subject,
    history: prepareHistory(history as ChatMessage[]),
    images: images as ChatImage[],
    apiKey: apiKey as string | undefined,
    profile: learningProfile(body.profile, LEGACY_PROFILE),
    photoContext,
    rememberPhotos: body.clientVersion === 3,
  };
}

export async function readChatRequest(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES)
    throw new ChatRequestError("Pedido demasiado grande.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ChatRequestError("Corpo da requisição inválido.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new ChatRequestError("Pedido demasiado grande.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      throw new ChatRequestError("Corpo da requisição inválido.");
    }
    return validateChatRequest(parsed);
  } finally {
    reader.releaseLock();
  }
}
