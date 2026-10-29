# Tutor IA 1.3.1 — teclado Android

- Desativa android.captureInput, que substituía a ligação normal do WebView ao
  teclado por uma ligação simplificada sem o contexto normal de edição.
- Recupera a integração nativa para composição de palavras, sugestões e correção
  automática, de acordo com o teclado e as definições do dispositivo.
- O campo da pergunta mantém autocomplete/autocorrect ativos, spellcheck e idioma
  do perfil. PIN, chave API e endereço do servidor mantêm as opções próprias de
  escrita, sem ativar correção de segredos ou endereços.
- Android versionCode 10. Tutor IA Teste conserva a identidade
  com.tutoria.estudos.preview e pode ser atualizado com a mesma chave de assinatura.

O comportamento visual das sugestões e a correção de palavras devem ser confirmados
no teclado do dispositivo. A app permite a integração; as sugestões são fornecidas
pelo teclado instalado. As funcionalidades da 1.3.0 mantêm-se nesta versão.
