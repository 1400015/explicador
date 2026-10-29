"use client";
import { createContext, useContext } from "react";
import type { TutorLocale } from "./learning-profile";

export const LocaleContext = createContext<TutorLocale>("pt-PT");
const BR_COPY: Record<string, string> = {
  "Definições (pais)": "Configurações (pais)",
  "Definições dos pais": "Configurações dos pais",
  "Definições bloqueadas": "Configurações bloqueadas",
  "Fechar definições": "Fechar configurações",
  Definições: "Configurações",
  "Secção para os pais. Configura como a app fala com a IA.":
    "Área dos responsáveis. Configure como o app conversa com a IA.",
  "Introduz o PIN dos pais para aceder às definições.":
    "Digite o PIN dos responsáveis para acessar as configurações.",
  "Modo de ligação": "Modo de conexão",
  "Automático começa, por defeito, no Gemini 3.6 Flash. Latest acompanha as versões escolhidas pela Google. A escolha explícita usa sempre esse modelo no chat e na verificação de segurança.":
    "Automático começa, por padrão, no Gemini 3.6 Flash. Latest acompanha as versões escolhidas pelo Google. A escolha explícita usa sempre esse modelo no chat e na verificação de segurança.",
  "Flash Lite custa menos por token no plano pago. Os limites gratuitos dependem do projeto Google; um preço menor não garante mais perguntas gratuitas.":
    "Flash Lite custa menos por token no plano pago. Os limites gratuitos dependem do projeto Google; um preço menor não garante mais perguntas gratuitas.",
  Guardar: "Salvar",
  "Guardar as alterações": "Salvar as alterações",
  "guardar as alterações": "salvar as alterações",
  "A tua pergunta": "Sua pergunta",
  "Escreve a tua dúvida aqui...": "Escreva sua dúvida aqui...",
  "Tirar foto com a câmara": "Tirar foto com a câmera",
  "Anexar foto da galeria": "Anexar foto da galeria",
  "Limpar conversa": "Limpar conversa",
  "A preparar a fotografia…": "Preparando a fotografia…",
  "O tutor está a preparar a resposta": "O tutor está preparando a resposta",
  "Não entendi — explica de uma forma mais simples":
    "Não entendi — explique de um jeito mais simples",
  "Tentar guardar novamente": "Tentar salvar novamente",
  "Falar em vez de escrever": "Falar em vez de escrever",
  "A ouvir... fala agora": "Ouvindo... fale agora",
  "Conversas recentes": "Conversas recentes",
  "Ainda não tens conversas guardadas. Envia a primeira pergunta! 💡":
    "Você ainda não tem conversas salvas. Envie a primeira pergunta! 💡",
  "Idioma e ensino": "Idioma e ensino",
  "País de estudo": "País de estudo",
  "Ano escolar": "Ano escolar",
  Currículo: "Currículo",
  "O tutor adapta a linguagem, os exemplos e a voz. Os contactos de apoio seguem o país de estudo.":
    "O tutor adapta a linguagem, os exemplos e a voz. Os contatos de apoio seguem o país de estudo.",
  "Enunciados das últimas fotografias": "Enunciados das últimas fotografias",
  "Disponíveis nesta conversa para as perguntas seguintes. As imagens não são guardadas.":
    "Disponíveis nesta conversa para as próximas perguntas. As imagens não são salvas.",
  Resumo: "Resumo",
  Fotografia: "Fotografia",
  "Criar PIN de proteção": "Criar PIN de proteção",
  "🔒 Definições bloqueadas": "🔒 Configurações bloqueadas",
  "⚙️ Definições": "⚙️ Configurações",
  "Dica: podes anexar uma foto do teu caderno ou ficha com o botão 📎!":
    "Dica: você pode anexar uma foto do seu caderno ou atividade com o botão 📎!",
  "A app fala com um servidor teu": "O app conversa com seu servidor",
  "📱 Esta app": "📱 Este app",
  "Funciona sozinha, sem servidor": "Funciona sem um servidor próprio",
  "✅ No modo “Esta app” não precisas de servidor nenhum — o telemóvel fala diretamente com a IA do Google. Só precisas de internet.":
    "✅ Neste modo, o celular conversa diretamente com a IA do Google. Você só precisa de internet.",
  "Obtém uma chave em aistudio.google.com/apikey.":
    "Obtenha uma chave em aistudio.google.com/apikey.",
  "Guardar a chave neste navegador entre sessões (armazenamento local sem encriptação)":
    "Salvar a chave neste navegador entre sessões (armazenamento local sem criptografia)",
  "⚠️ Se o telemóvel for perdido ou roubado, a chave pode ser usada por outra pessoa. Se isso acontecer, apaga a chave no aistudio.google.com e cria outra.":
    "⚠️ Se o celular for perdido ou roubado, outra pessoa poderá usar a chave. Nesse caso, exclua a chave em aistudio.google.com e crie outra.",
  "Endereço do servidor (opcional na app Android)":
    "Endereço do servidor no Android",
  "https://teu-servidor.com": "https://seu-servidor.com",
  "Permitir HTTP apenas num servidor da rede local (as perguntas e fotos seguem sem encriptação)":
    "Permitir HTTP apenas em um servidor da rede local (perguntas e fotos são enviadas sem criptografia)",
  "O navegador usa o servidor onde esta aplicação está publicada. A chave pertence ao servidor.":
    "O navegador usa o servidor onde este aplicativo está publicado. A chave pertence ao servidor.",
  "As definições, chaves e conversas locais não participam de backups nem de transferência automática. Numa reinstalação, configura novamente a chave.":
    "As configurações, chaves e conversas locais não participam de backups nem de transferência automática. Ao reinstalar, configure a chave novamente.",
  "🔒 Confirma o PIN para": "🔒 Confirme o PIN para",
  "O PIN (4 a 6 dígitos) protege esta secção: é pedido para abrir as definições e para alterar ou apagar a chave API. Guardado apenas como hash (nunca em texto).":
    "O PIN (4 a 6 dígitos) protege esta área: é solicitado para abrir as configurações e alterar ou excluir a chave API. É salvo apenas como hash.",
  "Repetir novo PIN": "Repita o novo PIN",
  "A testar...": "Testando...",
  "Conclui a ação em curso ou remove as fotos antes de atualizar.":
    "Conclua a ação em andamento ou remova as fotos antes de atualizar.",
  "A pergunta escrita fica guardada nesta sessão.":
    "A pergunta digitada fica salva nesta sessão.",
  "A atualizar…": "Atualizando…",
  "A tua pergunta mantém-se no campo de escrita — tenta enviar outra vez quando tiveres rede. 📶":
    "Sua pergunta continua no campo de texto. Tente enviar novamente quando a conexão voltar. 📶",
  "💛 Se estiveres a passar por algo difícil, não tens de passar sozinho/a. Pedir ajuda é sinal de força!":
    "💛 Se você estiver passando por algo difícil, não precisa enfrentar isso sozinho/a. Pedir ajuda é sinal de força!",
  "Fechar contactos de apoio": "Fechar contatos de apoio",
  "Esqueceste-te do PIN? A app não guarda o PIN em texto — terás de limpar os dados da app nas Definições do Android (ou reinstalá-la) e configurar de novo.":
    "Esqueceu o PIN? O app não salva o PIN em texto. Será necessário limpar os dados nas configurações do Android ou reinstalar e configurar novamente.",
  "No Android, a chave fica cifrada e protegida pelo Android Keystore. O PIN limita o acesso às definições.":
    "No Android, a chave fica criptografada e protegida pelo Android Keystore. O PIN limita o acesso às configurações.",
  "No navegador, a chave é usada diretamente na Google. Guardar só nesta sessão reduz a persistência; o PIN não cifra o armazenamento do browser.":
    "No navegador, a chave é usada diretamente na Google. Salvar apenas nesta sessão reduz a persistência; o PIN não criptografa o armazenamento do navegador.",
  "Na app Android, indica o endereço do computador/servidor onde corre o Tutor IA (ex.: http://192.168.1.42:3000). A chave API fica nesse servidor — mais seguro.":
    "No Android, informe o endereço do servidor que executa o Tutor IA (ex.: http://192.168.1.42:3000). A chave API fica nesse servidor.",
  "Não consegui verificar a resposta em segurança. Tenta enviar a pergunta outra vez daqui a pouco. 📚":
    "Não consegui verificar a resposta com segurança. Tente enviar sua pergunta novamente daqui a pouco. 📚",
  "Não consegui ler os enunciados da fotografia com segurança. Tenta novamente ou envia uma fotografia mais nítida.":
    "Não consegui ler os enunciados da fotografia com segurança. Tente novamente ou envie uma foto mais nítida.",
  "PIN incorreto. Tenta de novo.": "PIN incorreto. Tente novamente.",
  "O PIN tem de ter 4 a 6 dígitos.": "O PIN deve ter de 4 a 6 dígitos.",
  "Os dois PINs não coincidem.": "Os dois PINs não são iguais.",
  "Apagar chave": "Excluir chave",
  "Apagar conversa": "Excluir conversa",
  "Não consegui guardar ou apagar os dados no dispositivo. Mantém a app aberta e tenta novamente.":
    "Não consegui salvar ou excluir os dados no dispositivo. Mantenha o app aberto e tente novamente.",
  "O reconhecimento de voz não está disponível neste telemóvel.":
    "O reconhecimento de voz não está disponível neste celular.",
  "Preciso de acesso ao microfone para te ouvir. Aceita a permissão.":
    "Preciso de acesso ao microfone para ouvir você. Autorize o acesso.",
  "Não consegui perceber. Fala mais perto do telemóvel.":
    "Não consegui entender. Fale mais perto do celular.",
  "O teu browser não suporta reconhecimento de voz.":
    "Seu navegador não oferece reconhecimento de voz.",
  "Não consegui perceber. Tenta outra vez.":
    "Não consegui entender. Tente novamente.",
  "Não ouvi nada. Tenta outra vez. 🎤": "Não ouvi nada. Tente novamente. 🎤",
  "Preciso de acesso ao microfone. Aceita a permissão. 🎤":
    "Preciso de acesso ao microfone. Autorize o acesso. 🎤",
  "Deu erro ao ouvir. Tenta outra vez. 🎤":
    "Ocorreu um erro ao ouvir. Tente novamente. 🎤",
  "Fecha as outras janelas desta aplicação antes de atualizar, para conservar o trabalho em curso.":
    "Feche as outras janelas deste aplicativo antes de atualizar para preservar o trabalho em andamento.",
  "Não consegui atualizar. Tenta novamente.":
    "Não consegui atualizar. Tente novamente.",
};
export function copyFor(locale: TutorLocale) {
  return (text: string) =>
    locale === "pt-BR" && text.trim()
      ? text.replace(text.trim(), BR_COPY[text.trim()] ?? text.trim())
      : text;
}

export function useLocale() {
  const locale = useContext(LocaleContext);
  return { locale, t: copyFor(locale) };
}
