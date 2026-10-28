# Tutor IA

Tutor de estudos para alunos de cerca de 12 anos, com perguntas guiadas, fotografias,
ditado, leitura e verificação local de cálculos. Next.js + TypeScript para web/PWA
e Capacitor para Android.

Esta branch prepara a versão **1.3.0**, sobre a estabilização da 1.2.0. Os APKs antigos da raiz são da versão 1.1.5.
Novos artefactos são produzidos pelo build e pelo workflow de release.

## Desenvolvimento

Requer Node 22 (ver .nvmrc).

~~~bash
npm ci
cp .env.example .env.local
npm run dev
~~~

No modo Servidor, configurar GEMINI_API_KEY no ambiente/.env.local.
Obter chaves em https://aistudio.google.com/apikey.

## Modos

| Plataforma / modo | Destino | Origem da chave |
| --- | --- | --- |
| Browser / Esta app | Google diretamente pelo SDK | Sessão ou armazenamento local escolhido pelos pais |
| Browser / Servidor | API na mesma origem | Ambiente do servidor |
| Android / Esta app | Google por HTTP nativo | Cofre local Android Keystore |
| Android / Servidor | Servidor configurado por HTTP nativo | Ambiente desse servidor |

“Testar ligação” e chat usam o mesmo percurso de geração e moderação. Uma falha TLS
ou de rede não muda silenciosamente de modo. No Android usar HTTPS; HTTP requer
opção explícita e endereço IP privado/loopback. Nesse caso, perguntas e fotos seguem
sem encriptação na rede local. O WebView não admite conteúdo misto.

## Chave, PIN e dados

- Android: chave Gemini cifrada com AES-256-GCM e chave AES no Android Keystore.
  A migração confirma o novo segredo antes de retirar a cópia antiga.
- Metadados de segurança têm gravação nativa com confirmação. Os dados locais não
  participam de backup nem de transferência automática entre dispositivos.
- Browser: chave na sessão por defeito; persistência local é uma opção dos pais.
  Esse armazenamento não é cifrado pelo PIN. A migração de uma chave web antiga
  conserva a persistência anterior, que pode ser alterada nas Definições.
- PIN de 4–6 dígitos com PBKDF2-SHA-256, 600 000 iterações e salt aleatório.
  O formato SHA-256 antigo migra depois de um desbloqueio correto.
- Tentativas incorretas têm atraso progressivo persistente, até 5 minutos,
  também ao reabrir. Todas as operações usam a mesma verificação.
- Até 5 conversas com as últimas 20 mensagens; fotografias só na memória da sessão.
  Fotos redimensionadas e sem EXIF antes de enviar.
- Limpar invalida respostas pendentes e remove a cópia guardada. Falhas de envio
  conservam pergunta e anexos para repetir.

No modo direto a chave, perguntas, histórico necessário e fotos atuais são usados
para contactar a Google. No modo Servidor o backend faz essa chamada. As estatísticas
locais são contadores por dia/matéria, sem conteúdo das conversas.

## Proteções do tutor

Prompt pedagógico, filtros e configurações de segurança do modelo complementam a
moderação integral da resposta. Apenas um resultado estrito aprova o texto gerado.
Falha ou timeout do moderador não apresenta nem guarda a resposta e permite repetir.

O banner de apoio mantém-se depois da resposta e reativa perante novo pedido de
ajuda. Contactos de Portugal: SOS Voz Amiga e 112. Nas Definições, os pais escolhem pt-PT/pt-BR, país (Portugal/Brasil), ano escolar e currículo. A voz e os contactos de apoio acompanham essas escolhas.

## Perfil escolar e contexto das fotografias

Em **Definições → Idioma e ensino**, escolher o idioma, o país de estudo, o ano
escolar e o currículo nacional correspondente ou internacional. O Brasil inclui
os nove anos do ensino fundamental e os três do ensino médio. O ano é uma
referência pedagógica; não são pedidos nome ou data de nascimento. Sem perfil
anterior, a interface adota pt-PT, Portugal e 7.º ano.

A variante aplica-se à interface principal, às respostas, ao ditado e à leitura.
A voz exata depende das vozes instaladas. Os recursos de apoio seguem o país:
Portugal mantém SOS Voz Amiga/112; Brasil usa CVV 188 e SAMU 192.

Ao enviar fotografias, o tutor devolve a resposta e um resumo estruturado dos
exercícios visíveis. Ambos passam pela moderação antes de aparecerem ou serem
guardados. O painel **Enunciados das últimas fotografias** permite consultar a
transcrição. Nas perguntas seguintes, incluindo Não entendi, a app envia esse
contexto textual; as imagens anteriores não são reenviadas.

Só o último grupo de fotografias é conservado como contexto: até quatro imagens,
oito enunciados e 5000 caracteres de contexto. Uma nova fotografia substitui esse
contexto depois de uma resposta aprovada; uma leitura sem enunciados legíveis
retira o contexto anterior. Limpar/apagar a conversa elimina também o resumo.
As imagens continuam temporárias e não entram no armazenamento das conversas.

O modo Servidor exige também atualizar o backend para suportar o novo perfil e
a memória das fotografias. Pedidos de clientes anteriores continuam compatíveis,
com o contexto pedagógico antigo. Nenhum campo permite escolher modelo ou endpoint.

Ver [notas 1.3.0](docs/RELEASE_NOTES_1.3.0.md).

## Configuração

| Variável | Uso |
| --- | --- |
| GEMINI_API_KEY | Credencial do servidor |
| GEMINI_MODEL | Modelo do servidor |
| GEMINI_THINKING_LEVEL | LOW, MEDIUM ou HIGH no servidor |
| NEXT_PUBLIC_GEMINI_MODEL | Modelo direto incorporado no build |
| NEXT_PUBLIC_GEMINI_THINKING_LEVEL | Raciocínio direto incorporado no build |
| GEMINI_ALLOW_LEGACY_KEYS | Compatibilidade temporária com clientes antigos; por defeito 0 |

Os valores públicos não incluem credenciais. Mudar o modelo direto exige recompilar.
O pedido HTTP não pode escolher modelo ou endpoint.

Numa atualização de servidor com clientes web antigos: manter temporariamente
GEMINI_ALLOW_LEGACY_KEYS=1, distribuir a interface/PWA nova, confirmar a atualização
dos clientes e voltar a 0. Clientes novos nunca enviam a chave local ao backend.

## PWA

~~~bash
npm run build
npm start
~~~

O build gera public/sw.js com cache por versão e os recursos HTML/JS/CSS necessários.
Usar os scripts npm de build. API, respostas RSC e recursos externos não são guardados.

Depois da instalação completa, a interface, conversas, cálculos e dicas funcionam
offline. A geração IA exige internet. O rascunho é conservado nesta sessão.

A atualização é explícita, aguarda envios/processamento e pede para fechar outras
janelas. Fotos pendentes devem ser enviadas ou removidas. Instalação incompleta
conserva a versão anterior. O worker não é registado em desenvolvimento nem no APK.

## Testes

~~~bash
npm test
npm run lint
npx tsc --noEmit
npm run build
npx playwright install chromium
npm run test:integration
npm run build:static
~~~

Integração usa Gemini simulada, sem chave real; não existe bypass na aplicação
de produção. Cobre API compilada, UI, migrações, modos, moderação, PIN, offline e updates.

CI: Node 22, builds servidor/estático, browser e Android com JDK 21, SDK 36 e Build
Tools 36.0.0. Testes instrumentados do cofre correm num emulador do job Android.

## Android

Requer JDK 21 completo, Android SDK e ANDROID_HOME.

~~~bash
npm run android:sync
npm run android:apk
node scripts/check-apk.mjs android/app/build/outputs/apk/debug/app-debug.apk --debug
~~~

APK debug em android/app/build/outputs/apk/debug/app-debug.apk, para dispositivo ou
emulador de teste. A assinatura debug não atualiza a app release já distribuída.
A atualização exige keystore original e a mesma identidade com.tutoria.estudos.

Ver [distribuição e validação](docs/DISTRIBUICAO.md).
