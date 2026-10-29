# Estado da evolução — Tutor IA 1.3.6

Esta branch acrescenta perfil de idioma/ensino e contexto persistente das últimas
fotografias sobre a estabilização da 1.2.0 do PR #11. A versão não foi publicada.

- [Funcionamento e configuração](README.md)
- [Notas 1.3.0 e limites da implementação](docs/RELEASE_NOTES_1.3.0.md)
- [Correção do teclado em 1.3.1](docs/RELEASE_NOTES_1.3.1.md)
- [Diagnóstico da ligação em 1.3.2](docs/RELEASE_NOTES_1.3.2.md)
- [Tentativa alternativa após erro do serviço em 1.3.3](docs/RELEASE_NOTES_1.3.3.md)
- [Tempos de espera e alternativa após timeout em 1.3.4](docs/RELEASE_NOTES_1.3.4.md)
- [Escolha do modelo e aliases Latest em 1.3.5](docs/RELEASE_NOTES_1.3.5.md)
- [Apresentação das respostas, automático 3.6 e Flash Lite em 1.3.6](docs/RELEASE_NOTES_1.3.6.md)
- [Distribuição Android](docs/DISTRIBUICAO.md)
- [Validação final em dispositivo](docs/GUIAO_VALIDACAO_FINAL.md)
- [Evidências anteriores da estabilização 1.2.0](docs/VALIDACAO_1.2.0.md)

O perfil é guardado com as definições protegidas pelo PIN existente. O contexto
extraído das fotografias é guardado com a conversa depois da moderação integral.
Não se guardam as imagens. Ambos são usados nos três percursos de ligação.

A validação com Gemini real, vozes/câmara num Android físico e atualização com a
keystore original continua necessária. As evidências da 1.2.0 são históricas e
não substituem a avaliação das funcionalidades novas.

Em 29/10/2026, o utilizador confirmou uma resposta real no chat da 1.3.5 com
Gemini 3.6 Flash. As capturas seguintes mostram diagnóstico simples aprovado
nesse modelo e timeouts em 3.8 e nos dois aliases Latest. Não comprovam falha
de quota nem qualidade de fotografias. O Flash Lite fixo ainda não foi confirmado
com a chave do dispositivo.
