# Tutor IA 1.3.5 — modelo escolhido nas Definições

O dispositivo confirmou que o pedido simples responde com gemini-3.6-flash e
que Testar chave consegue uma resposta completa. O chat continua a apresentar
falhas; essas capturas não comprovam que o modelo seja a única causa.

- Modelo de IA, nas Definições em Esta app: Automático, Flash Lite Latest,
  Flash Latest, Gemini 3.6 Flash e Gemini 3.8 Flash.
- Os identificadores dos aliases são gemini-flash-lite-latest e
  gemini-flash-latest. A Google pode mudar o modelo subjacente a um alias; Latest
  não fixa uma versão nem garante disponibilidade com a chave do utilizador.
- Escolha explícita repete apenas o mesmo identificador após erro transitório.
  Automático conserva o principal/alternativo definidos no build (3.8/3.6).
- Preferência validada por lista fechada e guardada nos metadados de definições
  existentes, protegidos pelo PIN. Formato2, chave cifrada e perfil preservados.
  Instalações anteriores continuam em Automático até uma escolha explícita.
- Testar chave e Diagnosticar ligação usam a escolha editada; Guardar aplica-a
  ao chat. Aviso de alterações pendentes e campos de ligação bloqueados durante
  o teste. A moderação usa o identificador que gerou a resposta.
- Aliases omitem thinkingConfig, usando os valores predefinidos do destino para
  evitar parâmetros incompatíveis ao mudar de família. Modelos fixos conservam
  o nível configurado. Isso pode alterar latência/consumo conforme o destino.
- O modo Servidor continua a usar o modelo configurado no servidor. O corpo HTTP
  não transporta modelo nem a chave local; a seleção só afeta o modo direto.
- Erros do chat apresentam a referência da própria falha em Detalhes para apoio,
  recolhido. Referência sem dados de conversa, URL ou credenciais.
- Android versionCode14; Tutor IA Teste mantém identidade e assinatura local.

## Fontes oficiais consultadas em 29/10/2026

- [Aliases Latest](https://ai.google.dev/gemini-api/docs/models#latest): exemplo
  gemini-flash-latest e atualização do destino pela Google.
- [Referência dos modelos/aliases](https://ai.google.dev/api/interactions-api.md):
  enum ModelOption inclui gemini-flash-latest e gemini-flash-lite-latest.
- [ThinkingConfig do GenerateContent](https://ai.google.dev/api/generate-content#ThinkingConfig):
  parâmetros opcionais e compatibilidade dependente da família do modelo.

Sem a chave do dispositivo, a disponibilidade concreta dos aliases e a resposta
das perguntas escolares continuam a exigir confirmação no APK. Esta alteração
torna a escolha possível e visível; não declara resolvida a causa das falhas.
