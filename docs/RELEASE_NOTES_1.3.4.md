# Tutor IA 1.3.4 — timeout e orçamento das tentativas

A captura do dispositivo mostrou gemini-3.8-flash:TIMEOUT, sem tentativa no
modelo alternativo. Na 1.3.3 só os erros HTTP transitórios acionavam a alternativa,
e uma chamada nativa ainda usava 20 segundos de ligação e 55 de leitura.

- Timeout real pode acionar a única tentativa alternativa. Cancelamento manual,
  AbortError sem timeout, DNS, TLS e erros de chave/quota não a acionam.
- Cada tentativa recebe sinal de cancelamento próprio, ligado ao pedido, com
  temporizador de 20 segundos. SDK e servidor usam esse sinal e limite HTTP.
- A geração Android usa 5 segundos para ligação e 15 para leitura. O helper
  aguarda o resultado/rejeição da chamada nativa antes de iniciar a alternativa,
  mesmo se o temporizador já expirou. Não lança chamadas nativas concorrentes
  por meio de uma corrida entre promessas.
- Raciocínio LOW por defeito em vez de HIGH para reduzir latência no chat. O nível
  continua configurável no build/servidor. Modelo principal e alternativo mantidos.
- A verificação de segurança dispõe de até 512 tokens, em vez de 32, para acomodar
  raciocínio e a decisão SIM/NAO. Só essa decisão exata aprova/rejeita; outro texto
  ou falta de resposta continua indisponível. O pedido simples dispõe de 256.
- A moderação continua obrigatória, com orçamento de 15 segundos e no modelo que
  respondeu. O cliente conserva o prazo global de 60 segundos e as proteções de
  respostas antigas. O HTTP nativo para um servidor usa leitura de 58 segundos,
  para cobrir o trabalho desse servidor dentro do prazo global do cliente.
- Android versionCode 13. Tutor IA Teste conserva identidade e assinatura local.
- Diagnosticar ligação, nas Definições em modo Esta app, envia apenas um pedido
  fixo e curto à API, sem dados da conversa. Apresenta confirmação construída pela
  app e o modelo que respondeu; descarta o texto gerado. O Testar chave continua
  a verificar o percurso completo do tutor, incluindo moderação.

No HTTP nativo, ligação/leitura são limites de socket, não um prazo total rígido
da chamada Java: DNS, vários IPs e leituras sucessivas podem prolongá-la. O prazo
global termina a espera da interface e bloqueia continuações; não cancela a rede
Java já iniciada. A alternativa só começa depois de a chamada anterior terminar.

Fontes: [troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting)
e [raciocínio](https://ai.google.dev/gemini-api/docs/thinking) da Google.

O utilizador confirmou que AI Studio responde e a app falha em Wi-Fi e dados
móveis. Isso não comprova elegibilidade do projeto/chave para chamadas à API.
O novo pedido simples ajuda a separar essa ligação do processamento do tutor.
A correção não prova por si só acesso real à API: o resultado do APK continua a
exigir confirmação no dispositivo, sem partilhar a chave.
