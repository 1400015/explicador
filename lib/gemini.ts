import { GoogleGenAI } from "@google/genai";

export { MODEL, THINKING_LEVEL, buildSystemPrompt } from "./prompt";
export type { Subject } from "./prompt";
export { SUBJECT_LABELS } from "./prompt";

let client: GoogleGenAI | null = null;

export function getAi(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY n\u00e3o est\u00e1 definida. Configure no arquivo .env.local");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}
