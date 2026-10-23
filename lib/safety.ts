const BLOCKED_TOPICS = [
  /\b(como (fazer|criar|montar)\b.{0,40}(bomba|arma|explosivo|drogas? ilegais))/i,
  /\b(receita de|como sintetizar)\b/i,
  /\b(conte\u00fado sexual expl\u00edcito|pornografia)\b/i,
];

export function containsBlockedContent(text: string): boolean {
  return BLOCKED_TOPICS.some((pattern) => pattern.test(text));
}

const OUTPUT_BLOCKED_PATTERNS = [
  /\b(como (fazer|criar|montar)\b.{0,40}(bomba|arma|explosivo|drogas? ilegais))/i,
  /\b(receita de|como sintetizar)\b/i,
  /\b(conte\u00fado sexual expl\u00edcito|pornografia|como fazer sexo|fazer sexo|vamos transar|quero transar|vou te comer|linguagem sexual expl\u00edcita)\b/i,
  /\b(sexo|rela\u00e7\u00f5es sexuais|ato sexual)\b.{0,30}\b(comigo|contigo|com uma crian\u00e7a|pra mim)\b/i,
  /\b(suicid[a-z]*|me matar|como morrer)\b/i,
  /\b(instru\u00e7\u00f5es para (ferir|machucar|matar) algu\u00e9m)/i,
];

export function outputIsInappropriate(text: string): boolean {
  return OUTPUT_BLOCKED_PATTERNS.some((pattern) => pattern.test(text));
}

export const SAFE_FALLBACK =
  "Hmm, essa resposta n\u00e3o ficou boa para a tua idade. Vamos tentar outra coisa? Pensa numa pergunta sobre as tuas mat\u00e9rias! \ud83d\udcda";

export const GEMINI_KEY_PATTERN = /^AIza[0-9A-Za-z_-]{35}$/;
