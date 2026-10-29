# Tutor IA 1.2.0

Código preparado para validação e distribuição. Publicação e atualização dependem
da assinatura original e dos testes em dispositivo.

- Corrige chat web, validação HTTP, histórico, limpeza de conversas e pedidos antigos.
- Moderação comum com resultado explícito e prazo total; falhas não aprovam conteúdo.
- Melhora apoio infantil, mobile, foco dos diálogos e tratamento de fotografias.
- Unifica chat e teste: Google direta em Esta app; backend próprio em Servidor.
- Protege chave Android com Keystore/AES-GCM e confirma migração antes de remover legado.
- Desativa logs de bridge e backup/transferência dos dados locais.
- Migra PIN legado para PBKDF2 e conserva atrasos progressivos.
- Cache PWA por build, recursos offline completos e atualização explícita que preserva
  rascunho e protege o trabalho noutras janelas.
- Regressões HTTP/browser/offline, testes Android e verificação de APKs.
