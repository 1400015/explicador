# Tutor IA 1.3.2 — diagnóstico da ligação

- Conserva os códigos de exceção do Android para distinguir DNS, TLS, timeout e
  falhas de ligação, antes apresentados como erro genérico.
- O teste nas Definições apresenta uma referência com versão, modo e categoria
  fixa ou status HTTP. Não apresenta mensagens nativas, chaves ou URLs do pedido.
- Os erros de processamento TypeError deixam de ser classificados automaticamente
  como falta de internet. O painel offline exige uma falha de rede reconhecida
  ou indicação de ausência de rede pelo dispositivo.
- A leitura de status nativo exige um padrão HTTP explícito, evitando confundir
  portas e timeouts com códigos da resposta.
- Usa verificações de cancelamento compatíveis com WebViews sem throwIfAborted.
- Android versionCode 11. A identidade e assinatura locais da Tutor IA Teste
  mantêm-se, permitindo atualizar a instalação de teste sem apagar os dados.

A captura do dispositivo mostrou a mensagem genérica, não um status HTTP nem um
código nativo. A causa da falha nesse telemóvel continua a exigir confirmação
com a nova referência. Esta versão melhora o diagnóstico e a compatibilidade;
não comprova por si só uma ligação Gemini bem-sucedida no dispositivo.
