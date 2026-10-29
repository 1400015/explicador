# Guião de validação final — Tutor IA 1.3.4

Usar um dispositivo ou perfil Android de teste. Registar o modelo, a versão do
Android, o commit, a versão da app e o resultado de cada cenário. Os registos não
devem incluir a chave API, palavras-passe, PIN nem conteúdo pessoal das conversas.

O APK debug permite testar uma instalação nova. Para atualizar a app release
existente é necessário um APK assinado com a keystore original. Não desinstalar
a app em utilização para contornar a diferença de assinatura: isso apaga dados.

Para testar ao lado de uma instalação existente, usar o APK Tutor IA Teste
(variante preview, identidade com.tutoria.estudos.preview). Essa app tem dados e
configuração próprios e deve pedir a chave novamente. Os cenários de atualização
assinada da app original continuam a usar a variante release.

## 1. Instalação nova e ligação real

1. Instalar o APK no perfil de teste e abrir sem configurar uma chave. A interface
   deve abrir e explicar como configurar a ligação.
2. Nas Definições, escolher Esta app, introduzir uma chave Gemini válida e testar
   a ligação. Enviar depois uma pergunta escolar no chat, com e sem fotografia.
3. Escolher Servidor e indicar um backend HTTPS com a chave no ambiente desse
   servidor. Testar a ligação e repetir a pergunta no chat.
4. Confirmar erros claros para chave inválida, servidor indisponível e falta de
   rede. A app não deve mudar de modo e deve conservar pergunta e anexos.
5. Se for usado um backend local HTTP, confirmar que exige a opção explícita e
   um endereço local. Um endereço público HTTP deve ser rejeitado.

Resultado esperado: Testar ligação e chat usam o mesmo destino em cada modo.
No teste, registar a referência segura de erro (versão/modo/categoria ou HTTP),
sem divulgar a chave. Distinguir DNS, TLS, timeout e erros locais; estes últimos
não devem abrir o painel que anuncia ausência de internet.
Confirmar que 503 na geração tenta o modelo alternativo apenas uma vez, respeita
cancelamento e prazo total e usa esse modelo na moderação. Erros 400/401/403/404,
quota 429, DNS e TLS não originam essa tentativa. Se ambos falharem, o teste deve
mostrar os dois modelos/códigos e distinguir UNAVAILABLE de resposta não JSON.
Confirmar também alternativa após timeout real, sem repetir cancelamento manual
nem AbortError sem indicação de timeout. Cancelar durante a geração ou a espera
deve impedir nova tentativa e qualquer gravação tardia. No nativo, só iniciar a
segunda chamada depois de a primeira terminar/rejeitar; nunca sobrepor por timer.
No modo Esta app, comparar Diagnosticar ligação (pedido fixo, sem histórico,
fotografias ou apresentação de texto gerado) com Testar chave (tutor completo).
Registar o modelo e a referência. Um sucesso do diagnóstico não comprova por si
só a geração/moderação de perguntas escolares e fotografias.

## 2. Geração e moderação

1. Testar Matemática, Ciências e Português com exercícios adequados ao aluno.
   Confirmar dicas compreensíveis, perguntas orientadoras e adaptação depois de
   escolher Não entendi.
2. Perguntar sobre proporções numa receita de bolo: não deve haver bloqueio
   genérico da palavra receita.
3. Testar pedidos fora do âmbito e uma tentativa de desviar as instruções do
   tutor. Confirmar uma resposta segura e o regresso aos estudos.
4. Num cenário de teste com sinal de perigo, confirmar que o apoio continua
   visível depois da resposta e que pode ser dispensado e reativado.

Registar apenas o identificador do exercício e se o resultado foi adequado. Os
testes automáticos com respostas simuladas já cobrem indisponibilidade do moderador;
este passo avalia o comportamento do modelo real e a qualidade das respostas.

## 3. Câmara, voz e ciclo de vida

1. Fotografar e selecionar uma imagem da galeria. Enviar enquanto a imagem ainda
   está a ser processada; a pergunta e o anexo devem ser conservados.
2. Autorizar e recusar separadamente câmara e microfone. A recusa deve ser tratada
   sem crash. Testar ditado e leitura quando suportados pelo dispositivo.
3. Escrever com o teclado aberto, rodar o ecrã e regressar à app após a suspender.
   Confirmar que os controlos continuam acessíveis e que o histórico não duplica.
   No campo da pergunta, confirmar sugestões e a correção de uma palavra que o
   teclado corrija habitualmente noutras apps. Confirmar escrita com acentos e
   correção por toque numa sugestão. Na chave API e no PIN, confirmar que não há
   correção automática dos caracteres introduzidos.
4. Enviar e limpar a conversa durante o pedido. A resposta antiga não deve reaparecer.
5. Criar conversas em disciplinas diferentes, fechar a app e reiniciar o dispositivo.
   Confirmar recuperação e eliminação persistente das conversas de teste.

## 4. Atualização da versão 1.1.5 e segurança

Este cenário exige a assinatura original e uma instalação antiga no perfil de teste.

1. Na versão antiga, guardar uma chave válida, configurar um PIN e criar conversas
   de teste. Fechar e reabrir para confirmar o estado inicial.
2. Instalar a versão 1.3.0 assinada por cima, sem desinstalar nem limpar os dados.
3. Confirmar conversas, disciplina ativa, PIN e funcionamento da chave no modo
   Esta app. Fechar, reiniciar o dispositivo e voltar a confirmar.
4. Errar o PIN três vezes, fechar e reabrir as Definições: o atraso não deve ser
   eliminado. Confirmar depois o desbloqueio com o PIN correto e a sua alteração.
5. Apagar a chave durante um pedido: a resposta pendente deve ser interrompida,
   a pergunta conservada e o modo alterado para Servidor. Reabrir e confirmar que
   o modo Esta app exige configurar novamente a chave.
6. Num perfil de teste separado, confirmar que uma reinstalação não recupera
   automaticamente chave, PIN ou conversas por backup.

Os testes instrumentados complementam estes passos com verificações do texto
cifrado, IV aleatório, recriação do cofre, remoção e rejeição de adulteração.

## 5. PWA instalada

1. Instalar a PWA num browser suportado, abrir online e aguardar a instalação
   completa. Criar uma conversa e fechar a aplicação.
2. Ativar modo de avião e voltar a abrir. Histórico, cálculo e dicas locais devem
   continuar interativos. A geração remota deve explicar a falta de ligação e
   conservar a pergunta e as fotografias para repetir.
3. Voltar a ligar a rede e repetir o envio sem duplicar mensagens.
4. Disponibilizar um segundo build na mesma origem de teste. Confirmar atualização
   explícita, conservação do rascunho e das conversas, bloqueio com fotografias ou
   pedido pendente e indicação para fechar outras janelas.

## 6. Perfil de idioma e ensino

1. Nas Definições desbloqueadas, escolher pt-PT, Portugal, 7.º ano e currículo
   nacional. Guardar, reabrir e confirmar os valores. Perguntar sobre um exercício
   e confirmar português europeu e dificuldade adequada.
2. Mudar para pt-BR, Brasil e 1.º ano do ensino médio. Confirmar interface,
   resposta, reconhecimento de voz e leitura na variante escolhida; a voz depende
   do que estiver instalado. Confirmar CVV 188/SAMU 192 nos recursos de apoio.
3. Confirmar que país e idioma podem ser escolhidos separadamente e que a opção
   internacional conserva a seleção depois de reabrir.
4. Com PIN ativo, confirmar que mudar o perfil exige o mesmo desbloqueio e a
   confirmação de gravação que as restantes definições.

## 7. Contexto das fotografias

1. Enviar uma ficha de teste legível com dois exercícios identificados. Confirmar
   a dica do tutor e consultar Enunciados das últimas fotografias: transcrição e
   referências devem corresponder à imagem, sem soluções inventadas.
2. Perguntar pelo segundo exercício sem reenviar a fotografia. Repetir com Não
   entendi e depois de fechar/reabrir a app. Confirmar que o contexto se conserva.
3. Usar duas fotografias distintas e pedir o exercício da fotografia 2. Confirmar
   que as referências respeitam a ordem dos anexos.
4. Enviar uma nova ficha; o painel deve passar ao último grupo de fotografias.
   Uma leitura sem enunciados legíveis deve pedir outra foto e não reutilizar o
   contexto da ficha anterior como se pertencesse à nova.
5. Forçar falta de ligação ao enviar uma ficha: pergunta e anexos devem permanecer
   disponíveis e não deve aparecer um resumo anunciado como aprovado.
6. Limpar/apagar a conversa durante um pedido e reiniciar. Nem resposta antiga
   nem contexto antigo devem reaparecer.

## Registo de execução

| Cenário | Dispositivo / browser | Commit | Resultado / ocorrência |
| --- | --- | --- | --- |
| Instalação e dois modos reais | A preencher | A preencher | Pendente |
| Qualidade pedagógica e moderação reais | A preencher | A preencher | Pendente |
| Câmara, voz, teclado e ciclo de vida | A preencher | A preencher | Pendente |
| Atualização assinada, migração e PIN | A preencher | A preencher | Pendente |
| PWA instalada, offline e atualização | A preencher | A preencher | Pendente |
| Perfil pt-PT/pt-BR, país, ano e currículo | A preencher | A preencher | Pendente |
| Fotografia, seguimento, retoma e limpeza do contexto | A preencher | A preencher | Pendente |

Os resultados acima só são preenchidos depois da execução. Para assinatura,
credenciais de CI e preparação de release, ver [distribuição](DISTRIBUICAO.md).
