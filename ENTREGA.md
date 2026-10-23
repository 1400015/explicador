# Entrega do projeto "explicador" (Tutor IA)

## ⚠️ Nota importante sobre o GitHub

Não foi possível criar o repositório `explicador` no GitHub nem fazer push:
a conta GitHub deste ambiente tem **escrita bloqueada** (criar repos, adicionar
remotes e push estão desativados — política do ambiente). O projeto está 100%
preparado como repositório Git local, pronto a publicar.

## O que está entregue

Tudo em `/workspace/downloads/`:

| Ficheiro | Tamanho | O que é |
|---|---|---|
| `explicador-repositorio.tar.gz` | 12 MB | **Repositório Git completo** (bare) com todo o histórico — é literalmente o "explicador" pronto a publicar |
| `explicador-codigo-fonte.zip` | 248 KB | Código-fonte puro (sem APKs, sem node_modules, sem keystore) |
| `explicador-apks-android.zip` | 12 MB | Os 2 APKs assinados prontos a instalar |

## Como publicar no GitHub (2 minutos)

```bash
# 1. Descompacta o repositório
cd ~/Downloads
tar -xzf explicador-repositorio.tar.gz

# 2. No GitHub: cria um repositório privado chamado "explicador" (New repository)
#    NÃO inicializes com README (já tem conteúdo).

# 3. Publica:
cd explicador.git
git remote add origin https://github.com/<TEU-USER>/explicador.git
git push -u origin main
```

Depois o repositório fica em `https://github.com/<TEU-USER>/explicador`

## Segurança — o que NÃO foi incluído em lado nenhum

- ❌ `tutor-ia.keystore` (chave de assinatura dos APKs) — fica só no PC local
- ❌ `.env.local` (chave da API Gemini no servidor)
- ❌ `node_modules/`, `.next/`, builds do Gradle

Os APKs estão assinados e prontos a instalar, mas **guarda a keystore**: sem ela
não consegues assinar futuras atualizações da app.

## Conteúdo do repositório (90 ficheiros)

- **App Next.js completa**: chat com tutor IA (Gemini 3.8 Flash + raciocínio HIGH)
- **Fotos**: anexar da galeria (📎) ou fotografar com a câmara (📷), EXIF removido
- **Voz**: ditado (🎤) e leitura de respostas (🔊), pt-BR
- **Segurança de idade**: 4 camadas (prompt + safety settings + filtro de saída + moderação por IA)
- **Definições protegidas por PIN** (hash SHA-256 + salt), chave API no servidor ou na app
- **PWA instalável**: manifest + service worker + ícones
- **App Android (Capacitor)**: projeto completo em `android/`, ícones, splash, permissões
- **2 APKs assinados**: `tutor-ia-release.apk` (final) e `tutor-ia-debug.apk` (teste)

## Histórico Git (3 commits)

1. `38db86e` — Initial commit from Create Next App
2. `7fc2c65` — Tutor IA: app completa (chat, fotos, voz, PIN, PWA, Android)
3. `fea8ec5` — Adiciona APKs assinados para download direto
