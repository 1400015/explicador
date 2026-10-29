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

function errorFields(error: unknown) {
  const value =
    typeof error === "object" && error !== null
      ? (error as { message?: unknown; name?: unknown; code?: unknown })
      : null;
  return {
    message:
      typeof value?.message === "string"
        ? value.message
        : typeof error === "string"
          ? error
          : "",
    name: typeof value?.name === "string" ? value.name : "",
    code: typeof value?.code === "string" ? value.code : "",
  };
}

/** Categorias fixas: nunca apresentar mensagens nativas, URLs ou segredos. */
function connectionFailure(error: unknown) {
  const { message, name, code } = errorFields(error);
  switch (code) {
    case "UnknownHostException":
      return "DNS";
    case "SSLHandshakeException":
    case "SSLPeerUnverifiedException":
    case "SSLProtocolException":
    case "SSLException":
    case "CertificateException":
    case "CertPathValidatorException":
      return "TLS";
    case "SocketTimeoutException":
      return "TIMEOUT";
    case "ConnectException":
    case "SocketException":
    case "NoRouteToHostException":
    case "EOFException":
      return "CONNECTION";
  }
  const detail = `${code} ${name} ${message}`;
  if (
    /UnknownHostException|unable to resolve host|ENOTFOUND|EAI_AGAIN|name or service not known/i.test(
      detail,
    )
  )
    return "DNS";
  if (
    /SSLHandshakeException|SSLPeerUnverifiedException|SSLProtocolException|SSLException|CertificateException|CertPathValidatorException|trust anchor|certificate verify failed/i.test(
      detail,
    )
  )
    return "TLS";
  if (
    /SocketTimeoutException|timeout|timed out|deadline|AbortError|ETIMEDOUT/i.test(
      detail,
    )
  )
    return "TIMEOUT";
  if (
    /ConnectException|NoRouteToHostException|SocketException|connection refused|failed to connect|socket hang up|ECONNRESET|ECONNREFUSED/i.test(
      detail,
    )
  )
    return "CONNECTION";
  if (
    /Failed to fetch|NetworkError|network request failed|network error|network down|Load failed/i.test(
      detail,
    )
  )
    return "NETWORK";
  return null;
}

export function apiErrorDiagnostic(error: unknown): string {
  const { message, name, code } = errorFields(error);
  const value = error as {
    status?: unknown;
    error?: { code?: unknown };
    responseFormat?: unknown;
  } | null;
  const rawStatus = value?.status ?? value?.error?.code;
  if (
    typeof rawStatus === "number" &&
    Number.isInteger(rawStatus) &&
    rawStatus >= 100 &&
    rawStatus <= 599
  ) {
    const jsonStart = message.indexOf("{");
    const jsonEnd = message.lastIndexOf("}");
    const body =
      jsonStart >= 0 && jsonEnd > jsonStart
        ? parseBody(message.slice(jsonStart, jsonEnd + 1))
        : null;
    const state = body?.error?.status;
    const allowedStates = [
      "UNAVAILABLE",
      "DEADLINE_EXCEEDED",
      "INTERNAL",
      "INVALID_ARGUMENT",
      "UNAUTHENTICATED",
      "PERMISSION_DENIED",
      "RESOURCE_EXHAUSTED",
      "NOT_FOUND",
      "FAILED_PRECONDITION",
    ];
    if (
      body?.error?.code === rawStatus &&
      typeof state === "string" &&
      allowedStates.includes(state)
    )
      return `HTTP_${rawStatus}_${state}`;
    return (
      `HTTP_${rawStatus}` +
      (value?.responseFormat === "TEXT" ? "_NON_JSON" : "")
    );
  }
  const connection = connectionFailure(error);
  if (connection) return connection;
  if (/^(UNIMPLEMENTED|UNAVAILABLE)$/.test(code)) return "PLUGIN_UNAVAILABLE";
  if (/^(IllegalArgumentException|NullPointerException)$/.test(code))
    return "NATIVE_ERROR";
  if (name === "TypeError") return "JS_TYPE";
  if (
    /JSONException|SyntaxError/.test(`${code} ${name}`) ||
    /invalid JSON|not valid JSON/i.test(message)
  )
    return "RESPONSE_INVALID";
  return "UNKNOWN";
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
  const message = errorFields(error).message;
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

  // Um TypeError de processamento não prova falta de internet.
  if (connectionFailure(error)) return "network";
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
    "O serviço da IA devolveu um erro e não conseguiu responder. Usa o teste nas Definições para consultar a referência da falha. 🔁",
  "too-large":
    "A tua mensagem com fotos ficou demasiado grande. Tenta com menos fotos ou começa uma conversa nova. 📸",
  network:
    "Não consegui ligar à internet (ou a ligação foi abaixo). Confere o Wi-Fi/dados móveis e tenta de novo. 📶",
  unknown:
    "Não consegui concluir o pedido à IA. Nas Definições, usa o botão de teste da ligação para obter a referência do erro.",
};

export function friendlyApiError(error: unknown): string {
  const kind = classifyApiError(error);
  if (kind === "network") {
    switch (connectionFailure(error)) {
      case "DNS":
        return "Não consegui encontrar o endereço do serviço de IA (DNS). Experimenta alternar entre Wi-Fi e dados móveis e tenta novamente.";
      case "TLS":
        return "Não consegui estabelecer uma ligação segura ao serviço de IA (TLS). Confirma a data e hora automáticas do telemóvel e experimenta outra rede.";
      case "TIMEOUT":
        return "A ligação ao serviço de IA demorou demasiado. Tenta novamente ou experimenta outra rede.";
      case "CONNECTION":
        return "Não consegui estabelecer a ligação ao serviço de IA. Experimenta alternar entre Wi-Fi e dados móveis.";
    }
  }
  return MESSAGES[kind];
}
