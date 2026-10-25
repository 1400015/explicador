# Entrega do projeto "explicador" (Tutor IA)

## ✅ Publicado no GitHub

- **Repositório (privado):** https://github.com/1400015/explicador
- **Versão atual:** `v1.1.1` ✅ *(recomendada — instala esta)*
- **Releases:** https://github.com/1400015/explicador/releases
  - **v1.1.1** — aceita as **novas chaves API da Google (formato `AQ....`)**, além das antigas `AIza...` *(corrige "não parece válida")*
  - v1.1.0 — app completa: conversas guardadas, banner de apoio, botão "Não entendi",
    verificador de cálculo, dicas offline, estatísticas para os pais, segurança reforçada
  - v1.0.1 — app Android autónoma (sem servidor)
  - v1.0.0 — primeira versão (tinha bug do ecrã branco)
- **APKs para download direto** (na raiz do repositório, versão **1.1.1**):
  - [⬇️ tutor-ia-release.apk](https://github.com/1400015/explicador/raw/main/tutor-ia-release.apk) — versão final assinada (~6,5 MB)
  - [⬇️ tutor-ia-debug.apk](https://github.com/1400015/explicador/raw/main/tutor-ia-debug.apk) — versão de teste (~8,0 MB)

> 🚨 **Se a tua chave dá "não parece válida":** a Google mudou o formato das chaves em 2026 —
> as novas começam por **`AQ.`** em vez de `AIza`. A v1.1.0 rejeitava-as. **Instala a v1.1.1**,
> que aceita os dois formatos. Não precisas de revogar a chave nem gerar outra.

## ⚠️ IMPORTANTE: atualiza a versão antiga primeiro

Se já tens a app instalada (v1.0.x), **a v1.1.0 instala por cima normalmente** (mesma
assinatura, versionCode superior) — o Android aceita a atualização direta.
A v1.0.0 (ecrã branco) é que deve ser **desinstalada** primeiro.

## Como instalar a app no telemóvel (v1.1.1)

1. Abre o link do **tutor-ia-release.apk** no browser do telemóvel e descarrega
   (ou transfere o ficheiro por USB/WhatsApp/email)
2. Vai a **Definições → Segurança** e permite "Instalar apps de fontes desconhecidas"
   (ou segue o aviso ao abrir o ficheiro)
3. Abre o APK descarregado e instala
4. Abre a app — **já abre direto, sem precisar de computador ligado** ✅
5. Toca em **⚙️ Definições** (canto superior direito):
   - Escolhe o modo **📱 Esta app**
   - Cola a tua **chave API do Google Gemini** (obtém em https://aistudio.google.com/apikey)
     — pode começar por `AIza...` (antiga) ou `AQ....` (nova), ambas funcionam ✅
   - Toca em **Guardar**
   - (Opcional, recomendado) Cria um **PIN** de 4–6 dígitos para proteger as Definições
6. Pronto! A app já responde — só precisa de internet no telemóvel 📶

> ℹ️ A app funciona **sozinha**: a interface está dentro do APK e o telemóvel fala
> diretamente com a IA do Google. Não é preciso servidor, nem computador ligado, nem Wi-Fi de casa.

> ℹ️ Alternativa sem instalar nada: a **PWA** — abre a app web publicada num servidor
> (Vercel/Netlify) no browser do telemóvel e "Adicionar ao ecrã principal".

## O que tem a v1.1.0 (novo em relação à v1.0.1)

### Para a criança
- 💬 **Conversas guardadas**: as últimas 5 ficam no telemóvel — lista no ecrã inicial para reabrir
- 🤔 **Botão "Não entendi"** em cada resposta: a IA reexplica mais simples, com exemplo do dia a dia
- ✅ **Verificador de cálculo**: escreve `12*4+3 = 51` e a app diz na hora se está certo — sem dar a resposta
- 📴 **Dicas offline**: sem internet, recebe dicas pedagógicas da matéria em vez de um erro

### Para os pais
- 📊 **Estatísticas de uso** nas Definições (atrás do PIN): perguntas por dia e por matéria nos últimos 7 dias — só contadores, nunca o conteúdo das conversas
- 🧹 **"Limpar conversa" apaga de verdade** — limpa o ecrã e a conversa guardada (correção de privacidade)

### Segurança reforçada
- 🛡️ **Filtro de saída mais abrangente**: automutilação (sem bloquear contexto escolar), challenges perigosos (blackout, blue whale, etc.), pedidos de contacto pessoal (número, morada, encontros)
- 🆘 **Banner de apoio**: se a criança escrever sobre bullying, agressões, solidão ou perigo, aparece um banner com **SOS Voz Amiga (213 544 545)**, **112** e incentivo a falar com um adulto de confiança
- 🔄 **Moderação por IA com retry**: falhas de rede já não fazem saltar a verificação
- 🧪 **76 testes automatizados** (`npm test`) + CI no GitHub (typecheck + lint + testes + build em cada push)

## O que mudou na v1.0.1 (correção do ecrã branco)

A v1.0.0 abria a página a partir de um servidor local (`http://192.168.1.100:3000`).
Sem esse servidor a correr, a app ficava com o ecrã branco. Na v1.0.1:

- A interface está **embutida no APK** (export estático) — abre sempre
- Novo modo **"Esta app"**: o telemóvel chama a Gemini **diretamente**, sem servidor
- As **4 camadas de segurança** (prompt + safety settings + filtro de saída + moderação
  por IA) foram movidas para um módulo partilhado e funcionam **também no modo direto**
- Novo campo **endereço do servidor** para quem quiser usar um servidor próprio
- Se não houver servidor configurado, a app **explica o que fazer** em vez de ficar branca

## Segurança — o que NÃO foi incluído em lado nenhum

- ❌ `tutor-ia.keystore` (chave de assinatura dos APKs) — fica só no PC local
- ❌ `.env.local` (chave da API Gemini no servidor)
- ❌ `node_modules/`, `.next/`, `out/`, builds do Gradle

Os APKs estão assinados e prontos a instalar, mas **guarda a keystore em segurança**:
sem ela não consegues assinar futuras atualizações da app (o Android recusaria
instalar uma atualização assinada com outra chave).

No modo "Esta app", a chave API fica guardada **no telemóvel** (protegida por PIN, se
criado). Se o telemóvel for perdido ou roubado: apaga a chave em
aistudio.google.com/apikey e cria uma nova.

## Conteúdo do repositório

- **App Next.js completa**: chat com tutor IA (Gemini 3.8 Flash + raciocínio HIGH)
- **Fotos**: anexar da galeria (📎) ou fotografar com a câmara (📷), EXIF removido
- **Voz**: ditado (🎤) e leitura de respostas (🔊), pt-BR
- **Segurança de idade**: 4 camadas (prompt + safety settings + filtro de saída + moderação por IA)
- **Banner de apoio infantil**: SOS Voz Amiga, 112, adulto de confiança
- **Verificador de cálculo local**: confirma contas sem resolver pela criança
- **Dicas offline** por matéria quando não há internet
- **Conversas guardadas** (últimas 5) e **estatísticas para os pais** (últimos 7 dias)
- **Definições protegidas por PIN** (hash SHA-256 + salt), chave API no servidor ou na app
- **App Android autónoma**: interface embutida no APK, funciona sem servidor
- **PWA instalável**: manifest + service worker + ícones
- **2 APKs assinados v1.1.0**: `tutor-ia-release.apk` (final) e `tutor-ia-debug.apk` (teste)
- **Testes**: `npm test` (76 testes) + CI no GitHub Actions

## Histórico Git (resumo)

1. `38db86e` — Initial commit from Create Next App
2. `7fc2c65` — Tutor IA: app completa (chat, fotos, voz, PIN, PWA, Android)
3. `fea8ec5` — Adiciona APKs assinados para download direto
4. `b4d2851` — Adiciona documento de entrega
5. `9c79954` — ENTREGA.md: repositório e release v1.0.0 publicados
6. `3324ce7` — v1.0.1: App Android autónoma, modo direto, 38 testes
7. `79944d0`…`13e1231` — v1.1.0: 10 melhorias (conversas, banner de apoio, botão
   "Não entendi", verificador de cálculo, dicas offline, estatísticas, segurança reforçada, CI)
8. (último) — Correções v1.1.0: build de servidor arranjado (prerender) e "limpar conversa"
   passa a apagar a conversa guardada; APKs v1.1.0 (versionCode 2) publicados

Tags: `v1.0.0`, `v1.0.1`, `v1.1.0` → releases em https://github.com/1400015/explicador/releases
