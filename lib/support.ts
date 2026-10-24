"use client";

/**
 * Deteção de pedidos de ajuda: se a criança mencionar bullying, abuso,
 * autolesão ou perigo, a app mostra um banner fixo com contactos de apoio.
 * Não substitui a resposta do tutor — complementa-a.
 */

const HELP_PATTERNS = [
  /\b(meus? (colegas?|amigos?|professor[ae]s?) (me )?(batem|zoam|humilham|excluem|gozam))/i,
  /\b(sofro|sofri|estou a sofrer| sou v[ií]tima d[oe])\b.{0,30}\b(bullying|bully)/i,
  /\b(bullying)\b.{0,40}\b(comigo|comigo na|na minha turma|na aula|na escola)\b/i,
  /\b(fa[zc]em|fazem|andam a? fazer) (bullying) (a|com|para) (mim|comigo)/i,
  /\b(sofro|sofri|apanho|levo) (pancada|surra|palmada)/i,
  /\b(meus? (pai|m[eã]e)s?|meu padrasto|minha madrasta) (me )?(bate|bater|bateram|castiga|grita|machuca)/i,
  /\b(quero|vou|penso em)\s*-?\s*(me)\s+(matar|machucar|cortar|magoar)/i,
  /\b(quero|vou|penso em)\s+(suicidar|acabar com tudo)/i,
  /\b(sinto\s*-?\s*me|me\s+sinto)\s+(sozinh[oa]|triste demais|sem sa[ií]da|n[aã]o aguento)/i,
  /\b(algu[eé]m) (me) (machuca|fere|toca)\b/i,
  /\b(estou|tenho) (a) (ser|sofrer) (maltratad[oa]|abusad[oa])/i,
];

export function needsSupportBanner(text: string): boolean {
  return HELP_PATTERNS.some((pattern) => pattern.test(text));
}

export const SUPPORT_RESOURCES = [
  {
    emoji: "🫂",
    name: "SOS Voz Amiga (Portugal)",
    detail: "Telefone e chat para jovens — todos os dias",
    contact: "213 544 545 · sosvozamiga.org",
  },
  {
    emoji: "☎️",
    name: "Linha Nacional de Emergência",
    detail: "Qualquer emergência, 24 horas",
    contact: "112",
  },
  {
    emoji: "👨‍👩‍👧",
    name: "Um adulto de confiança",
    detail: "Pais, professores, treinador, avós — conta a alguém em quem confias",
    contact: "",
  },
];
