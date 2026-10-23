# Entrega do projeto "explicador" (Tutor IA)

## ✅ Publicado no GitHub

- **Repositório (privado):** https://github.com/1400015/explicador
- **Tag:** `v1.0.0`
- **Release publicada:** https://github.com/1400015/explicador/releases/tag/v1.0.0
  - Nome: *Tutor IA v1.0.0 — primeira versão completa*
  - Descrição com todas as funcionalidades e segurança
- **APKs para download direto** (na raiz do repositório):
  - [⬇️ tutor-ia-release.apk](https://github.com/1400015/explicador/raw/main/tutor-ia-release.apk) — versão final assinada (~6,2 MB)
  - [⬇️ tutor-ia-debug.apk](https://github.com/1400015/explicador/raw/main/tutor-ia-debug.apk) — versão de teste (~9,2 MB)

> ℹ️ Nota: os APKs estão publicados como ficheiros no repositório (descarregáveis pelos
> links acima e listados na página da release). Anexá-los como *assets* da release pela
> interface web (botão "Edit release" → "Attach binaries") é opcional — o download
> funciona igualmente pelos links diretos.

## Como instalar a app no telemóvel

1. Abre o link do `tutor-ia-release.apk` no browser do telemóvel e descarrega.
2. Vai a **Definições → Segurança** e permite "Instalar apps de fontes desconhecidas"
   (ou segue o aviso ao abrir o ficheiro).
3. Abre o APK descarregado e instala.
4. Na primeira abertura, vai a **⚙️ Definições** e configura a chave da API Gemini
   (modo servidor ou modo app — o modo app pede/cria PIN de 4–6 dígitos para proteger).

> ⚠️ A app Android vem apontada para o servidor local (`http://192.168.1.100:3000`).
> Para a usar fora de casa, publica a app web (Vercel/Netlify/etc.) ou muda o
> `server.url` em `capacitor.config.ts`, corre `npm run build && npx cap sync android`
> e gera um novo APK. Alternativa sem mexer em nada: usar a **PWA** — abre a app web
> no browser do telemóvel e "Adicionar ao ecrã principal".

## Segurança — o que NÃO foi incluído em lado nenhum

- ❌ `tutor-ia.keystore` (chave de assinatura dos APKs) — fica só no PC local
- ❌ `.env.local` (chave da API Gemini no servidor)
- ❌ `node_modules/`, `.next/`, builds do Gradle

Os APKs estão assinados e prontos a instalar, mas **guarda a keystore em segurança**:
sem ela não consegues assinar futuras atualizações da app (o Android recusaria
instalar uma atualização assinada com outra chave).

## Conteúdo do repositório

- **App Next.js completa**: chat com tutor IA (Gemini 3.8 Flash + raciocínio HIGH)
- **Fotos**: anexar da galeria (📎) ou fotografar com a câmara (📷), EXIF removido
- **Voz**: ditado (🎤) e leitura de respostas (🔊), pt-BR
- **Segurança de idade**: 4 camadas (prompt + safety settings + filtro de saída + moderação por IA)
- **Definições protegidas por PIN** (hash SHA-256 + salt), chave API no servidor ou na app
- **PWA instalável**: manifest + service worker + ícones
- **App Android (Capacitor)**: projeto completo em `android/`, ícones, splash, permissões
- **2 APKs assinados**: `tutor-ia-release.apk` (final) e `tutor-ia-debug.apk` (teste)

## Histórico Git

1. `38db86e` — Initial commit from Create Next App
2. `7fc2c65` — Tutor IA: app completa (chat, fotos, voz, PIN, PWA, Android)
3. `fea8ec5` — Adiciona APKs assinados para download direto
4. `b4d2851` — Adiciona documento de entrega
5. (seguinte) — ENTREGA.md atualizado: repositório e release v1.0.0 publicados

Tag `v1.0.0` publicada → release em
https://github.com/1400015/explicador/releases/tag/v1.0.0
