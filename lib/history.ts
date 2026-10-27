import { MAX_HISTORY_MESSAGES, type ChatMessage } from "./shared";

/** Texto apenas; os anexos pertencem ao pedido atual. Módulo puro, também usado no servidor. */
export function prepareHistory(history: ChatMessage[]): ChatMessage[] {
  const trimmed = history
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "model") &&
        typeof m.text === "string",
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map(({ role, text }) => ({ role, text }));
  while (trimmed.length && trimmed[0].role !== "user") trimmed.shift();
  return trimmed;
}
