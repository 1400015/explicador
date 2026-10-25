export type ChatImage = {
  mimeType: string;
  data: string;
};

export type ChatMessage = {
  role: "user" | "model";
  text: string;
  images?: ChatImage[];
};

export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_IMAGES_PER_MESSAGE = 4;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_HISTORY_MESSAGES = 20;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 20;
// Nota: nos modelos com reasoning (Gemini 3.x), os tokens de pensamento contam
// para o maxOutputTokens — 512 era pouco e podia cortar a resposta a meio.
export const MAX_OUTPUT_TOKENS = 1024;
