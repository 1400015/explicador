# Tutor IA 1.3.3 — alternativa após indisponibilidade da IA

O dispositivo devolveu 1.3.2/DIRECT/HTTP_503 na geração. Esse código comprova uma
resposta HTTP de erro; não comprova uma sobrecarga global nem identifica sozinho
o corpo da resposta.

- Após 500/502/503/504, a geração espera 1–1,25 segundos e tenta Gemini 3.6 Flash
  uma vez. O principal continua Gemini 3.8 Flash. Máximo de duas tentativas de
  geração por envio, com a mesma chave e a mesma Google, sem mudar de transporte.
- O modelo que respondeu é usado para moderar a resposta e o contexto fotográfico.
  Rejeição ou indisponibilidade da moderação continua a impedir apresentação e
  persistência do conteúdo. Cancelamento impede a continuação do pedido.
- Chave sem autorização, quota, modelo inexistente, DNS ou TLS não são repetidos
  por esta política. Configurações de modelo pertencem ao build/servidor, nunca
  ao pedido HTTP do utilizador.
- Referências do teste incluem os modelos e os resultados das tentativas. Sufixo
  UNAVAILABLE indica o código correspondente num corpo JSON compatível com a API;
  NON_JSON indica resposta textual/HTML. Nenhum corpo ou segredo é mostrado.
- A mensagem passa a indicar erro/indisponibilidade, sem presumir sobrecarga.
- Android versionCode 12. Tutor IA Teste conserva identidade, dados e assinatura
  local para permitir atualização da instalação de teste.

## Fontes verificadas em 29/10/2026

- [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash):
  modelo existente, com raciocínio low/medium/high.
- [Gemini 3.6 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash):
  modelo estável que continua disponível para produção, com imagens e JSON.
- [Troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting):
  repetição limitada e espera com jitter perante erros transitórios.

A causa específica do 503 nesse telemóvel permanece sem confirmação. O ambiente
de desenvolvimento não dispõe da chave do utilizador. Esta alteração tenta
recuperar a geração através de outro modelo, mas a resposta real tem de ser
confirmada no dispositivo.
