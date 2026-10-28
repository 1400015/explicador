# Estado da entrega — explicador / Tutor IA

O código prepara a versão **1.2.0**. Primeiro bloco: chat, conversas, moderação e
mobile. Segundo bloco: modos, chave protegida, PIN, PWA e CI/distribuição Android.

- [Funcionamento e configuração](README.md)
- [Notas da versão preparada](docs/RELEASE_NOTES_1.2.0.md)
- [Resultados e validações pendentes](docs/VALIDACAO_1.2.0.md)
- [Assinatura e validação Android](docs/DISTRIBUICAO.md)
- [CI](.github/workflows/ci.yml)
- [Release assinada em rascunho](.github/workflows/android-release.yml)

O repositório GitHub é público. Credenciais Gemini, keystore e palavras-passe não
são incluídas no código. O certificado público esperado impede distribuir um APK
com identidade diferente.

Os APKs da raiz são da versão 1.1.5. A versão 1.2.0 foi compilada localmente em
debug e release sem assinatura; o APK debug teve identidade, versão e assinatura
verificadas. Os resultados e as validações ainda pendentes constam do relatório.
O CI web e Android passou, incluindo quatro testes instrumentados no emulador.
Atualizar a instalação distribuída requer a keystore original. Publicação final
depende de Gemini real e Android. As notas anteriores continuam no histórico Git.
