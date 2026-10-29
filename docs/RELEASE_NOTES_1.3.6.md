# Tutor IA 1.3.6 — apresentação e modelo automático

## Evidência do dispositivo

O utilizador confirmou que o chat da 1.3.5 responde ao escolher Gemini 3.6 Flash.
As capturas mostram diagnóstico simples aprovado nesse modelo e TIMEOUT nas
duas tentativas de Gemini 3.8 Flash, Flash Latest e Flash Lite Latest. Timeout
não demonstra esgotamento de quota; não foi observado 429 nessas capturas.

## Alterações

- Respostas do tutor apresentam Markdown e matemática LaTeX, incluindo mensagens
  já guardadas. O texto original continua no histórico, envio e moderação.
- Fontes e estilos de matemática são locais, disponíveis no APK e na cache PWA.
  Conteúdo não fiável não permite HTML bruto, imagens remotas ou ações de links.
- Automático começa no Gemini 3.6 Flash e, perante erro transitório elegível,
  repete uma única vez esse modelo. Mantém aprovação obrigatória pelo mesmo
  modelo. Não começa nos aliases que falharam no dispositivo.
- Configurações de ambiente continuam a poder substituir principal/alternativo.
  Escolhas explícitas guardadas não mudam; modo Servidor não recebe modelo local.
- Gemini 3.5 Flash Lite fixo torna-se uma opção manual, com raciocínio LOW válido.
  A sua disponibilidade e qualidade no dispositivo ainda não foram confirmadas.
- Android versionCode 15; Tutor IA Teste mantém identidade e assinatura local.

## Flash Lite: custo e limites

Tarifas Standard em USD por milhão de tokens, consultadas em 29/10/2026:

| Modelo | Entrada | Saída, incluindo raciocínio |
| --- | ---: | ---: |
| Gemini 3.5 Flash Lite | 0,30 | 2,50 |
| Gemini 3.6 Flash | 0,75 | 3,75 |

O preço do 3.6 é promocional até 31/12/2026; a tabela anuncia 1,50/7,50 depois.
Para a mesma quantidade de tokens, o Lite custa atualmente 60% menos na entrada
e cerca de 33% menos na saída. Isso não permite prometer um número de perguntas:
comprimento, histórico, fotografias, raciocínio e moderação também consomem tokens.

Os limites gratuitos e pagos dependem do projeto, modelo e nível de utilização;
os valores efetivos estão no AI Studio. Menor preço não garante mais quota gratuita.

O 3.5 Flash Lite suporta texto, imagens, JSON e raciocínio. É uma opção plausível
para explicações escolares correntes, mas não foi comparado pedagogicamente com
3.6 nesta app. Mantém-se 3.6 em Automático por ser o único confirmado a funcionar;
o Lite fixo é opcional. Não há ensaio com a chave do utilizador neste ambiente.

## Fontes oficiais

- [Preços](https://ai.google.dev/gemini-api/docs/pricing)
- [Limites por projeto/modelo](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini 3.5 Flash Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
- [Ficha do modelo](https://deepmind.google/models/model-cards/gemini-3-5-flash-lite/)
- [Níveis de raciocínio](https://ai.google.dev/gemini-api/docs/thinking#controlling-thinking)
- [Aliases e versões](https://ai.google.dev/gemini-api/docs/models#latest)

## Verificação da implementação

ESLint, TypeScript, build de servidor, export estático, Capacitor sync e
assemblePreview passaram. A inspeção do binário confirmou versão/código,
identidade, assinatura local igual à 1.3.5, estilos de apresentação, 20 fontes
woff2 e integração normal do teclado. As fontes woff2 constam da precache PWA.
Foi corrigida a interferência do loader CSS existente com CSS Modules usando
classes prefixadas; os builds finais não têm esse aviso nem seletores :global.

Não foram adicionados nem executados testes locais; uma asserção existente foi
adaptada ao modelo por defeito. Revisão independente sem bloqueios. A aparência
final em Android físico e o novo Lite fixo aguardam confirmação no dispositivo.
