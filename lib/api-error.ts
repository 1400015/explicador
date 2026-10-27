/**
 * Traduz erros da API Gemini (ou de rede) em mensagens claras para a criança/pais.
 * O objetivo: nunca mostrar "probleminha genérico" — dizer o que aconteceu de facto.
 */

export type ApiErrorKind =
  | "invalid-key" // 400/401/403 — a chave não é válida ou não tem permissão
  | "invalid-request"
  | "quota" // 429 — quota/rate limit excedido
  | "model" // 404 — modelo não existe ou sem acesso
  | "blocked" // 400 com SAFETY — a resposta foi bloqueada pelos filtros
  | "overloaded" // 500/502/503/504 — serviço sobrecarregado ou a demorar
  | "too-large" // 408/413 — pedido demasiado grande (fotos/mensagem)
  | "network" // falha de fetch/timeout — sem internet, DNS, CORS, etc.
  | "unknown";

type GeminiErrorBody = {
  error?: {
    code?: number;
    status?: string;
    message?: string;
    details?: Array<{ reason?: string }>;
  };
};

function parseBody(raw: unknown): GeminiErrorBody | null {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as GeminiErrorBody;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && raw !== null) return raw as GeminiErrorBody;
  return null;
}

export function classifyApiError(error: unknown): ApiErrorKind {
  // Erro do SDK (@google/genai): ApiError tem .status (HTTP) e .message = JSON do body.
  // Também suportamos erros "planos" com .error.code por segurança.
  const anyErr = error as {
    status?: number;
    message?: string;
    error?: { code?: number; status?: string; message?: string };
  } | null;

  const status: number | undefined = anyErr?.status ?? anyErr?.error?.code;
  const message: string = anyErr?.message ?? "";
  // Extrai o primeiro JSON da mensagem (o SDK mete o body inteiro no .message)
  const jsonStart = message.indexOf("{");
  const jsonEnd = message.lastIndexOf("}");
  const body =
    jsonStart >= 0 && jsonEnd > jsonStart
      ? parseBody(message.slice(jsonStart, jsonEnd + 1))
      : null;
  const bodyStatus = body?.error?.code;
  const bodyStatusText = body?.error?.status;
  const bodyReason = body?.error?.details?.map((d) => d.reason ?? "").join(",");
  const effectiveStatus = status ?? bodyStatus;

  // Mapear o status textual do body (ex.: "INVALID_ARGUMENT", "RESOURCE_EXHAUSTED")
  if (bodyStatusText === "RESOURCE_EXHAUSTED") return "quota";
  if (
    bodyStatusText === "PERMISSION_DENIED" ||
    bodyStatusText === "UNAUTHENTICATED"
  )
    return "invalid-key";
  if (bodyStatusText === "NOT_FOUND") return "model";
  if (
    bodyStatusText === "UNAVAILABLE" ||
    bodyStatusText === "DEADLINE_EXCEEDED"
  )
    return "overloaded";

  if (bodyReason?.includes("SAFETY") || message.includes("SAFETY"))
    return "blocked";
  // Pedido demasiado grande (fotos em base64 no historico, etc.)
  if (
    effectiveStatus === 413 ||
    effectiveStatus === 408 ||
    /payload too large|request entity too large|request too large/i.test(
      message,
    )
  ) {
    return "too-large";
  }
  if (
    effectiveStatus === 401 ||
    effectiveStatus === 403 ||
    /API[_ ]KEY[_ ](INVALID|NOT VALID)|API key not valid/i.test(
      `${bodyReason} ${message}`,
    )
  ) {
    return "invalid-key";
  }
  if (effectiveStatus === 400) return "invalid-request";
  if (effectiveStatus === 429) return "quota";
  if (effectiveStatus === 404) return "model";
  // Erros do lado do servidor da Google que sao temporarios
  if (
    effectiveStatus === 500 ||
    effectiveStatus === 502 ||
    effectiveStatus === 503 ||
    effectiveStatus === 504 ||
    effectiveStatus === 508
  ) {
    return "overloaded";
  }

  // Sem status HTTP: timeout/rede -> "network", senao "unknown"
  const errName = error instanceof Error ? error.name : "";
  const looksLikeTimeout =
    /timeout|timed out|deadline|aborterror|socket hang up|econnreset|econnrefused|etimedout/i.test(
      `${errName} ${message}`,
    );
  if (
    error instanceof TypeError ||
    looksLikeTimeout ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("network") ||
    message.includes("fetch")
  ) {
    return "network";
  }
  return "unknown";
}

const MESSAGES: Record<ApiErrorKind, string> = {
  "invalid-key":
    "A chave API não está a funcionar. Nos pais: ⚙️ Definições → confirma a chave (AIza... ou AQ....) e toca em “Testar chave”.",
  "invalid-request":
    "Não consegui processar este pedido. Tenta reformular a pergunta ou enviar menos fotos. 📚",
  quota:
    "Ups, a IA está muito ocupada agora (limite de pedidos atingido). Espera 1 minuto e tenta de novo. ⏱️",
  model:
    "Este modelo de IA não está disponível com a tua chave. Fala com os teus pais para rever as Definições. ⚙️",
  blocked:
    "A tua pergunta foi bloqueada pelos filtros de segurança. Tenta perguntar de outra forma, sobre as tuas matérias. 📚",
  overloaded:
    "O serviço da IA está sobrecarregado ou a demorar demasiado. Espera um bocadinho e tenta de novo. 🔁",
  "too-large":
    "A tua mensagem com fotos ficou demasiado grande. Tenta com menos fotos ou começa uma conversa nova. 📸",
  network:
    "Não consegui ligar à internet (ou a ligação foi abaixo). Confere o Wi-Fi/dados móveis e tenta de novo. 📶",
  unknown:
    "Tive um probleminha para responder. Tenta de novo daqui a pouco. 🤏",
};

export function friendlyApiError(error: unknown): string {
  return MESSAGES[classifyApiError(error)];
}
