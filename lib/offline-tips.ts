import type { Subject } from "./prompt";

/**
 * Dicas offline: orientação pedagógica genérica por matéria, disponível
 * sem internet. Não substitui o tutor — dá um ponto de partida até a
 * ligação voltar.
 */

const OFFLINE_TIPS: Record<Subject, string[]> = {
  matematica: [
    "Lê o enunciado duas vezes e sublinha o que a pergunta pede.",
    "Escreve os dados do problema (números, unidades) numa lista antes de calcular.",
    "Tenta resolver um exemplo mais simples primeiro — com números pequenos fica mais fácil ver o padrão.",
    "Confere a tua resposta com um cálculo ao contrário (ex.: subtração confirma a soma).",
    "Desenha o problema! Frações, geometria e proporcionalidade ficam muito mais claras num papel.",
  ],
  ciencias: [
    "Separa a pergunta em partes: o que acontece? Porquê? O que provoca?",
    "Pensa em causa → efeito: o que muda primeiro e o que acontece depois?",
    "Relaciona com algo do dia a dia (cozinhar, plantas de casa, o tempo lá fora).",
    "Faz um esquema com setas a ligar os elementos (ex.: sol → água → vapor).",
    "Revisa o glossário da aula — muitas vezes a resposta está num termo que já aprendeste.",
  ],
  portugues: [
    "Identifica o tipo de exercício: interpretação, gramática ou produção de texto?",
    "Na interpretação, volta sempre ao texto e sublinha a frase que responde à pergunta.",
    "Em gramática, classifica passo a passo: classe de palavra → função → tempo verbal.",
    "Escreve primeiro um rascunho com começo, meio e fim — depois é só limar.",
    "Lê a tua resposta em voz alta: ouves os erros que os olhos não vêem.",
  ],
  historia: [
    "Situa o acontecimento no tempo (século/ano) e no espaço (país/região).",
    "Pergunta-te: quem? o quê? quando? onde? porquê? e com que consequências?",
    "Liga o evento a algo que já conheces — a História repete padrões.",
    "Distingue causa de consequência — confundir as duas é o erro mais comum.",
    "Faz uma linha do tempo com os marcos principais do tema.",
  ],
  geografia: [
    "Localiza primeiro no mapa: país, continente, hemisfério.",
    "Pensa nas relações: clima → vegetação → população → atividades económicas.",
    "Usa a legenda do mapa (cores, símbolos) — ela tem metade da resposta.",
    "Compara com o lugar onde vives: o que seria igual? o que seria diferente?",
    "Lê a pergunta com atenção: «explica» pede causas, «descreve» pede características.",
  ],
  geral: [
    "Reescreve a pergunta com as tuas palavras — metade da dúvida resolve-se aí.",
    "Divide o exercício em passos pequenos e faz um de cada vez.",
    "Procura um exemplo parecido nos teus apontamentos ou no manual.",
    "Se empacares mais de 10 minutos, passa ao exercício seguinte e volta depois.",
    "Pergunta a um colega ou professor — perguntar também é estudar!",
  ],
};

export function getOfflineTips(subject: Subject): string[] {
  return OFFLINE_TIPS[subject] ?? OFFLINE_TIPS.geral;
}

export const OFFLINE_MESSAGE =
  "Parece que estás sem internet! 📴 Enquanto a ligação não volta, aqui ficam umas dicas para avançares sozinho/a:";
