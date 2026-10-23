# Entrega do projeto "explicador" (Tutor IA)

## ✅ Publicado no GitHub

- **Repositório (privado):** https://github.com/1400015/explicador
- **Versão atual:** `v1.0.1` (a v1.0.0 tinha um bug: a app Android abria em branco sem servidor)
- **Releases:** https://github.com/1400015/explicador/releases
  - v1.0.1 — app Android **funciona sozinha** (sem servidor) ✅ *(recomendada)*
  - v1.0.0 — primeira versão
- **APKs para download direto** (na raiz do repositório):
  - [⬇️ tutor-ia-release.apk](https://github.com/1400015/explicador/raw/main/tutor-ia-release.apk) — versão final assinada (~6,5 MB)
  - [⬇️ tutor-ia-debug.apk](https://github.com/1400015/explicador/raw/main/tutor-ia-debug.apk) — versão de teste (~9,2 MB)

## ⚠️ IMPORTANTE: desinstala a versão antiga primeiro

Se instalaste a **v1.0.0** (a app ficava com o ecrã branco), **desinstala essa versão**
antes de instalar a nova — as duas têm o mesmo nome e assinatura, por isso o Android
pode recusar a atualização direta em alguns telemóveis.

## Como instalar a app no telemóvel (v1.0.1)

1. Abre o link do **tutor-ia-release.apk** no browser do telemóvel e descarrega
   (ou transfere o ficheiro por USB/WhatsApp/email)
2. Vai a **Definições → Segurança** e permite "Instalar apps de fontes desconhecidas"
   (ou segue o aviso ao abrir o ficheiro)
3. Abre o APK descarregado e instala
4. Abre a app — **já abre direto, sem precisar de computador ligado** ✅
5. Toca em **⚙️ Definições** (canto superior direito):
   - Escolhe o modo **📱 Esta app**
   - Cola a tua **chave API do Google Gemini** (obtém em https://aistudio.google.com/apikey)
   - Toca em **Guardar**
   - (Opcional, recomendado) Cria um **PIN** de 4–6 dígitos para proteger as Definições
6. Pronto! A app já responde — só precisa de internet no telemóvel 📶

> ℹ️ A app funciona **sozinha**: a interface está dentro do APK e o telemóvel fala
> diretamente com a IA do Google. Não é preciso servidor, nem computador ligado, nem Wi-Fi de casa.

> ℹ️ Alternativa sem instalar nada: a **PWA** — abre a app web publicada num servidor
> (Vercel/Netlify) no browser do telemóvel e "Adicionar ao ecrã principal".

## O que mudou na v1.0.1 (correção do ecrã branco)

A v1.0.0 abria a página a partir de um servidor local (`http://192.168.1.100:3000`).
Sem esse servidor a correr, a app ficava com o ecrã branco. Na v1.0.1:

- A interface está **embutida no APK** (export estático) — abre sempre
- Novo modo **"Esta app"**: o telemóvel chama a Gemini **diretamente**, sem servidor
- As **4 camadas de segurança** (prompt + safety settings + filtro de saída + moderação
  por IA) foram movidas para um módulo partilhado e funcionam **também no modo direto**
- Novo campo **endereço do servidor** para quem quiser usar um servidor próprio
- Se não houver servidor configurado, a app **explica o que fazer** em vez de ficar branca
- 38 testes automatizados (`npm test`) — incluindo um que apanhou e corrigiu uma falha
  no filtro de segurança

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
- **Definições protegidas por PIN** (hash SHA-256 + salt), chave API no servidor ou na app
- **App Android autónoma**: interface embutida no APK, funciona sem servidor
- **PWA instalável**: manifest + service worker + ícones
- **2 APKs assinados**: `tutor-ia-release.apk` (final) e `tutor-ia-debug.apk` (teste)
- **Testes**: `npm test` (38 testes de segurança/validação/PIN)

## Histórico Git

1. `38db86e` — Initial commit from Create Next App
2. `7fc2c65` — Tutor IA: app completa (chat, fotos, voz, PIN, PWA, Android)
3. `fea8ec5` — Adiciona APKs assinados para download direto
4. `b4d2851` — Adiciona documento de entrega
5. `9c79954` — ENTREGA.md: repositório e release v1.0.0 publicados
6. (v1.0.1) — App Android autónoma: interface embutida, modo "Esta app" direto,
   segurança partilhada cliente/servidor, campo de URL do servidor, 38 testes

Tag `v1.0.1` → release em https://github.com/1400015/explicador/releases
