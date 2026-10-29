const BLOCKED_TOPICS = [
  /\b(como (fazer|criar|montar)\b.{0,40}(bomba|arma|explosivo|drogas? ilegais))/i,
  /\b(receita de|como sintetizar)\b.{0,40}\b(coca[íi]na|metanfetamina|drogas? ilegais|explosivos?)\b/i,
  /\b(conte\u00fado sexual expl\u00edcito|pornografia)\b/i,
];

export function containsBlockedContent(text: string): boolean {
  return BLOCKED_TOPICS.some((pattern) => pattern.test(text));
}

const OUTPUT_BLOCKED_PATTERNS = [
  /\b(como (fazer|criar|montar)\b.{0,40}(bomba|arma|explosivo|drogas? ilegais))/i,
  /\b(receita de|como sintetizar)\b.{0,40}\b(coca[íi]na|metanfetamina|drogas? ilegais|explosivos?)\b/i,
  /\b(conte\u00fado sexual expl\u00edcito|pornografia|como fazer sexo|fazer sexo|vamos transar|quero transar|vou te comer|linguagem sexual expl\u00edcita)\b/i,
  /\b(sexo|rela\u00e7\u00f5es sexuais|ato sexual)\b.{0,30}\b(comigo|contigo|com uma crian\u00e7a|pra mim)\b/i,
  // Automutila\u00e7\u00e3o / suic\u00eddio: instru\u00e7\u00f5es ou incentivo direto (n\u00e3o apenas men\u00e7\u00e3o do tema em contexto escolar)
  /\b(como|maneiras? de|jeitos? de)\s+(me\s+)?(matar|machucar|magoar|cortar)\b/i,
  /\b(quero|vou|devias?|deverias?|podes?|experimenta)\s+((te|se|me)\s+)?(matar|machucar|cortar|magoar)\b/i,
  /\b(suicid[io]\w*)\s*[:\u2013-]?\s*(como|instru\u00e7\u00f5es|m\u00e9todos?|passos)/i,
  /\b(instru\u00e7\u00f5es para (ferir|machucar|matar) algu\u00e9m)/i,
  // Challenges perigosos de redes sociais
  /\b(challenge|desafio)\b.{0,30}\b(perigoso|mortal|de fogo|da bolinha|do apagar|do desodorante|do passemal|da asfixia|do desmaio|momo|ballerina|skull-breaker|breaking-skull)\b/i,
  /\b(blue ?whale|momo ?challenge|skull ?breaker|tide ?pod|choking|pass-out|blackout)\b.{0,30}\b(challenge|desafio|proveito|experimenta)/i,
  // Contacto pessoal: a IA nunca deve pedir dados privados da crian\u00e7a
  /\b(manda|envia|diz|passa|me d[a\u00e1])\b.{0,30}\b(teu|tua|sua|seu|o teu|a tua)\s+(n\u00famero|telefone|endere\u00e7o|morada|casa|escola|rede social|instagram|tiktok|whatsapp|snapchat)\b/i,
  /\b(qual(\s+\u00e9)?\s+o\s+teu|qual(\s+\u00e9)?\s+a\s+tua)\s+(n\u00famero|telefone|endere\u00e7o|morada|escola)\b/i,
  /\b(encontra(r)?|vamo(s)?\s+nos\s+ver|vamo(s)?\s+marcar)\b.{0,30}\b(pessoalmente|em pessoa|na vida real|sem os teus pais)\b/i,
];

export function outputIsInappropriate(text: string): boolean {
  return OUTPUT_BLOCKED_PATTERNS.some((pattern) => pattern.test(text));
}

export const SAFE_FALLBACK =
  "Hmm, essa resposta n\u00e3o ficou boa para a tua idade. Vamos tentar outra coisa? Pensa numa pergunta sobre as tuas mat\u00e9rias! \ud83d\udcda";

// A Google mudou o formato das chaves em 2026: além das "Standard keys" antigas
// (AIza + 35 caracteres), o AI Studio emite "Auth keys" novas no formato AQ.Ab...
// Ambas funcionam no endpoint nativo da Gemini (x-goog-api-key). Aceitamos as duas.
export const GEMINI_KEY_PATTERN =
  /^(AIza[0-9A-Za-z_-]{35}|AQ\.[0-9A-Za-z._-]{10,500})$/;
