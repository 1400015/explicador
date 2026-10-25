# 🎓 Tutor IA v1.1.0 — grandes melhorias de usabilidade, apoio e segurança

A v1.0.1 trouxe a app autónoma. **A v1.1.0 traz a app completa que a criança e os pais merecem.**

## ✨ Novidades

### 💬 Conversas guardadas
- As **últimas 5 conversas** ficam guardadas no telemóvel — já não se perde tudo ao fechar a app
- Lista "Conversas recentes" no ecrã inicial: reabrir ou apagar cada conversa

### 💛 Banner de apoio (segurança infantil)
- Se a criança escrever sobre **bullying, agressões, solidão ou perigo**, aparece um banner com contactos de apoio: **SOS Voz Amiga** (213 544 545), **112**, e incentivo a falar com um adulto de confiança
- Detenção conservadora (primeira pessoa) para não ativar em contexto escolar legítimo

### 🤔 Botão "Não entendi"
- Em cada resposta do tutor: um clique e a IA **reexplica de forma mais simples**, com exemplo do dia a dia — sem a criança ter de escrever

### ✅ Verificador de cálculo
- A criança escreve `12*4+3 = 51` e a app confirma na hora **certo/errado**, sem revelar o resultado — coerente com o tutor que nunca dá respostas prontas
- 100% local: instantâneo e sem consumir quota da API

### 📴 Dicas offline
- Sem internet: **dicas pedagógicas da matéria atual** (5 por matéria) em vez de um erro seco

### 📊 Estatísticas para os pais
- Nas Definições (atrás do 🔒 PIN): **perguntas por dia e matéria nos últimos 7 dias**
- Só contadores agregados — **o conteúdo das conversas nunca é guardado**

### 🛡️ Segurança reforçada
- Filtro de saída mais abrangente: **automutilação** (variantes instrucionais, sem bloquear contexto escolar), **challenges perigosos** de redes sociais, **pedidos de contacto pessoal** (número, morada, encontros)
- Moderação por IA com **retry** — falhas transitórias de rede já não saltam a verificação

### 🔧 Infraestrutura
- **CI (GitHub Actions)**: 76 testes + typecheck + lint + build em cada push/PR
- `.env.example`, limpeza de warnings e de assets não usados

## 📦 Para compilar o APK v1.1.0

O `versionCode` já está **2** e o `versionName` **1.1.0** no projeto Android:

```bash
npm run android:sync        # build estático (out/) + copia para o projeto Android
npm run android:apk:release  # assinado (precisa da keystore, JDK 21 e Android SDK)
```

Depois anexa o `app-release.apk` à release e apaga os APKs antigos da raiz, se quiseres.

## 🧪 Qualidade
- **76 testes automatizados** (38 → 76)
- `tsc`, `eslint` e build estático limpos na CI
