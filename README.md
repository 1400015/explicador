# Tutor IA 🎓

Um tutor de estudos com IA (Google Gemini) pensado para estudantes de ~12 anos.
A IA explica com linguagem simples, usa exemplos do dia a dia, **não dá respostas prontas**
e guia com perguntas para a criança mesma chegar à solução.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- SDK oficial `@google/genai` — modelo **Gemini 3.8 Flash** (`gemini-3.8-flash`) com
  **raciocínio (thinking level HIGH)** — quotas generosas da Google com preço introdutório
- **App Android** via Capacitor (`android/`) — **funciona sozinha, sem servidor** (interface
  embutida no APK + modo "Esta app" fala direto com a Gemini)
- **PWA instalável** (manifest + service worker) para usar no browser
- **Voz**: botão 🎤 para ditar (reconhecimento de voz nativo no Android, Web Speech API
  no browser) e 🔊 "Ouvir" em cada resposta do tutor (voz do sistema, pt-BR)

## Como rodar (versão web/servidor)

```bash
npm install
cp .env.example .env.local   # edite e coloque sua GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

Obtenha a chave em https://aistudio.google.com/apikey

## Fotos (trabalhos, fichas, caderno) 📸

O estudante pode anexar até **4 fotos por mensagem** (JPEG, PNG ou WebP) pelo botão 📎,
ou **tirar uma foto na hora** com o botão 📷 — na app Android abre a câmara traseira
nativamente (plugin `@capacitor/camera`); no browser/PWA abre a câmara diretamente.
A foto é redimensionada e sem metadados EXIF antes de sair do telemóvel.
O tutor enxerga a imagem e:

- descreve o que está vendo (ex.: "Vejo 5 problemas de fração...");
- **não resolve e não dá a resposta final** — dá uma dica ou pergunta guiada;
- pede foto mais nítida se a imagem estiver ilegível.

Antes de enviar, cada foto é **redimensionada (máx. 1600 px) e convertida para JPEG no navegador**,
o que remove metadados EXIF (GPS, câmara, etc.) — mais privacidade para a criança.
O servidor valida tipo, tamanho (máx. 4 MB por foto) e conteúdo base64 de todas as imagens.

## Secção de Definições ⚙️ (para os pais) — protegida por PIN 🔐

Botão ⚙️ no canto superior direito abre um modal onde o pai configura.
Se existir um **PIN** (4 a 6 dígitos), a secção fica bloqueada:

- é pedido o PIN para **abrir** as Definições;
- é pedido o PIN para **guardar alterações** na chave API;
- é pedido o PIN para **apagar** a chave API;
- dentro das Definições há uma secção "🔐 Criar/Alterar/Remover PIN" (para alterar ou
  remover o PIN é pedido o PIN atual).

O PIN **nunca é guardado em texto**: fica como hash SHA-256 com salt aleatório
(`lib/pin.ts`). Se o pai se esquecer do PIN, a app não consegue recuperá-lo —
é preciso limpar os dados da app nas Definições do Android e configurar de novo.

Dentro das Definições, o pai configura:

- **Modo "Esta app" (recomendado na app Android):** a app **não precisa de servidor nenhum**.
  A chave API do Gemini é guardada **no próprio telemóvel** (via `@capacitor/preferences`
  na app; `localStorage` no browser) e o telemóvel fala **diretamente** com a API do Google.
  Só precisa de internet. Tem botões **Testar chave** e **Apagar chave**.
  ⚠️ Se o telemóvel for perdido/roubado, quem o tiver pode usar a tua chave — nesse caso,
  apaga a chave no aistudio.google.com e cria outra.
- **Modo Servidor:** a app fala com um servidor teu (Next.js), que usa a chave do
  `.env.local`. Na app Android, indica-se o endereço do servidor (ex.: `http://192.168.1.42:3000`
  em casa, ou `https://teu-site.com` publicado). No browser/PWA, usa automaticamente o
  servidor onde a app está publicada. A chave nunca sai do servidor.

Em todos os modos, todas as proteções continuam ativas: rate limit, filtros de conteúdo,
safety settings do Gemini, moderação por IA e limites de tamanho.

## Segurança de idade (adequação a 12 anos) — 4 camadas

1. **System prompt reforçado** (`lib/prompt.ts`): proíbe violência, sexual, ódio, drogas,
   instruções perigosas; manda recusar com gentileza e redirecionar para os estudos; proíbe
   comportamento de "adulto romântico"; incentiva a falar com um adulto de confiança se em perigo.
2. **Safety settings do Gemini** no pedido: `SEXUALLY_EXPLICIT` bloqueado a partir de LOW,
   restantes categorias em ONLY_HIGH.
3. **Filtro de saída** (`lib/safety.ts`): deteta padrões de conteúdo inadequado na
   resposta da IA e substitui por uma resposta segura.
4. **Moderação por IA**: uma segunda chamada ao modelo (thinking LOW, máx. 16
   tokens) julga se o texto é adequado para 12 anos; se não for, é substituído.

A lógica de segurança é **partilhada** entre servidor (`app/api/chat/route.ts`) e app
(`lib/gemini-client.ts`), pelo que o modo "Esta app" tem as mesmas 4 camadas.

## Proteções incluídas

- Chave da API no servidor por defeito (proxy via `/api/chat`); modo "Esta app" opcional com aviso
- Validação de formato da chave (padrão `AIza...`) antes de chamar a API
- Chave guardada no telemóvel nunca aparece no histórico nem é mostrada por defeito
- **PIN de 4-6 dígitos protege as Definições** (abrir, alterar/apagar chave, alterar PIN)
- PIN guardado apenas como hash SHA-256 + salt — nunca em texto simples
- **Voz**: 🎤 ditado (plugin nativo `@capacitor-community/speech-recognition` no Android;
  Web Speech API no browser) e 🔊 leitura de respostas (speechSynthesis, pt-BR)
- Rate limit: 20 requisições/minuto (por IP no servidor; local no modo "Esta app")
- Limite de 1000 caracteres por mensagem, 4 fotos por mensagem e 512 tokens por resposta
- Validação de imagens (tipo permitido, tamanho, base64 válido)
- Redimensionamento no cliente + remoção de metadados EXIF/GPS
- Histórico limitado às últimas 20 mensagens

## Funcionalidades (v1.1.0)

- 💬 **Conversas guardadas** — as últimas 5 conversas ficam no telemóvel; lista no ecrã inicial para reabrir ou apagar
- 💛 **Banner de apoio** — se a criança mencionar bullying, abuso ou perigo, aparecem contactos de ajuda (SOS Voz Amiga, 112)
- 🤔 **"Não entendi"** — botão em cada resposta que pede uma explicação mais simples com exemplos do dia a dia
- ✅ **Verificador de cálculo** — `12*4+3 = 51` responde certo/errado na hora, sem revelar o resultado (local, sem quota de API)
- 📴 **Dicas offline** — sem internet, dicas pedagógicas da matéria atual em vez de um erro seco
- 📊 **Estatísticas para os pais** — perguntas por dia/matéria (últimos 7 dias) nas Definições, atrás do PIN; nunca o conteúdo das conversas
- 🛡️ **Filtro de saída reforçado** — automutilação, challenges perigosos de redes sociais e pedidos de contacto pessoal; moderação por IA com retry
- 🔧 **CI** — testes, typecheck, lint e build em cada push/PR (GitHub Actions)

## App Android 📱

A app **funciona sozinha** — instala e abre, sem precisar de computador ligado.
A interface está **embutida no APK** (export estático em `out/`), e no modo "Esta app"
o telemóvel fala diretamente com a Gemini (só precisa de internet + chave API guardada).

Os APKs compilados estão na raiz do repositório:

- `tutor-ia-release.apk` — versão final assinada (recomendada)
- `tutor-ia-debug.apk` — para testar

**Para instalar no telemóvel:**

1. Ativa **"Instalar apps desconhecidas"** (Definições → Segurança) para o browser/ficheiro
2. Transfere o APK para o telemóvel (USB, email, WhatsApp, etc.) e toca nele para instalar
3. Abre a app — ela abre direto, sem servidor
4. Toca em **⚙️ Definições**, escolhe o modo **📱 Esta app**, cola a tua chave API do Gemini
   (aistudio.google.com/apikey) e guarda. Em 2 minutos está pronto! ✅
5. (Opcional) Cria um **PIN** para proteger as Definições

**Para recompilar o APK:**

```bash
npm run android:sync       # build estático (out/) + copia para o projeto Android
npm run android:apk        # gera android/app/build/outputs/apk/debug/app-debug.apk
npm run android:apk:release
```

Para compilar precisas de **JDK 21** e **Android SDK** (ANDROID_HOME). No Android Studio é só
abrir a pasta `android/` — ele trata de tudo.

> ⚠️ A app Android no modo "Servidor" com endereço `http://...` só funciona na mesma rede
> Wi-Fi (HTTP local). Fora de casa, publica o servidor com HTTPS (Vercel, Railway, etc.).
> O modo "Esta app" funciona em qualquer lugar com internet.

### PWA instalável (alternativa sem APK)

1. Corre o servidor acessível na rede Wi-Fi: `npm run dev` (ou `npm run build && npm run start`) com `-H 0.0.0.0`
2. No telemóvel, abre `http://<ip-do-computador>:3000` no Chrome
3. Menu → **"Adicionar ao ecrã principal"** — fica com ícone próprio, abre em ecrã inteiro

## Testes

```bash
npm test    # 76 testes: filtros de segurança, prompt, validações, PIN, conversas, estatísticas, cálculo
```

## Estrutura

```
app/
  api/chat/route.ts      # proxy seguro para o Gemini (rate limit, filtros, limites)
  components/Chat.tsx    # interface de chat (seleção de matéria, fotos, histórico local)
  components/Settings.tsx# definições (modo, chave, URL do servidor, PIN)
  page.tsx               # página principal
lib/
  prompt.ts              # system prompt do tutor + modelo (partilhado cliente/servidor)
  safety.ts              # filtros de entrada/saída + moderação (partilhado)
  gemini.ts              # cliente Gemini do servidor (chave do .env.local)
  gemini-client.ts       # cliente Gemini direto do telemóvel (modo "Esta app")
  settings.ts            #Definições (modo, chave, serverUrl, PIN) — Preferences/localStorage
  pin.ts                 # PIN como hash SHA-256 + salt
  images.ts              # processamento de fotos no cliente (redimensiona, remove EXIF)
  camera.ts              # câmara nativa (Capacitor) com fallback web
  voice.ts               # ditado + leitura de voz
  shared.ts              # limites e tipos partilhados (cliente + servidor)
public/
  manifest.webmanifest   # PWA
  sw.js                  # service worker (app shell offline)
  icons/                 # ícones PWA
android/                 # projeto Android (Capacitor)
capacitor.config.ts      # configuração da app (appId, webDir=out, splash)
```

## Permissões Android

- `INTERNET` — falar com a Gemini (modo "Esta app") ou com o servidor (modo "Servidor")
- `CAMERA` — botão 📷 para fotografar exercícios (câmara não é obrigatória: a app
  funciona sem ela, só perde o botão de foto direta)
- `RECORD_AUDIO` — botão 🎤 para ditar perguntas por voz (a app pede a permissão em
  tempo de execução; sem ela, só desaparece o botão de ditado)

## Matérias suportadas

Matemática, Ciências, Português, História, Geografia e Geral — cada uma com um tom de saudação próprio.
