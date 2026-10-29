# Validação da versão 1.2.0

Atualizado em 28/10/2026. Implementação no [PR #11](https://github.com/1400015/explicador/pull/11).
ApplicationId com.tutoria.estudos, versionCode 8. A versão não foi publicada.

## Resultados confirmados

| Verificação | Resultado |
| --- | --- |
| Validações de lógica existentes | 117 passaram |
| Testes Node de persistência, PIN, moderação e transportes | 29 passaram |
| Regressões HTTP, interface, offline e atualização PWA | 27 passaram |
| TypeScript e ESLint | Passaram |
| Build servidor e export estático com Node 22 | Passaram |
| Capacitor sync | Passou |
| APK debug, APK de testes e release sem assinatura | Compilaram |
| Identidade, versão e assinatura debug | Verificadas |
| Verificador da assinatura original | Rejeitou o APK debug, como esperado |
| Testes instrumentados Android Keystore e metadados | 4 passaram no emulador Android 15 / API 35 |
| CI remoto web e Android | Passou |
| npm audit | 0 vulnerabilidades reportadas |
| YAML dos workflows e sintaxe shell | Verificados localmente |

Os testes web usam Chromium e Gemini simulada, carregada apenas pelo processo de
testes. Não houve pedidos de geração com credenciais reais. Android foi compilado
com Java 21 e SDK/Build Tools 36.

## Evidência do CI

[CI #32](https://github.com/1400015/explicador/actions/runs/40690665038), commit
2ee7c8b64e2e284f45a993a2611d960d2a2c6771: jobs web e Android concluídos com sucesso.
O relatório XML dos testes nativos confirmou quatro testes, zero falhas, zero erros
e zero testes ignorados. Os testes cobrem cifragem em repouso, leitura após recriar
o cofre, IV aleatório, eliminação, rejeição de adulteração e metadados confirmados.

Os artefactos do run incluem tutor-ia-debug e android-test-reports. O primeiro
contém o APK para uma instalação de teste; o segundo contém os relatórios HTML/XML.
A falha inicial do SDK foi corrigida no CI e no workflow de release, especificando
platform-tools em vez do pacote legado tools. A configuração do emulador usa
SwiftShader e o CI recolhe os relatórios mesmo quando os testes falham.

## Validação ainda necessária

- **Gemini real:** geração, moderação, acesso ao modelo e qualidade pedagógica.
- **Android físico:** dois modos de ligação, câmara, microfone, leitura, teclado,
  suspensão/retoma e persistência.
- **Atualização assinada:** usar a keystore original e verificar migração da chave,
  conversas e PIN sobre a instalação distribuída.
- **PWA instalada:** confirmar manualmente os cenários offline e de atualização
  num browser/dispositivo suportado. Os cenários automáticos já passaram.
- **Release assinada:** o workflow está preparado, mas não foi executado com a
  keystore privada original nesta sessão.

O APK debug serve para uma instalação de teste. Não atualiza a app release
distribuída. O build release sem assinatura comprova a compilação, mas não é uma
atualização distribuível.

Seguir o [guião de validação final](GUIAO_VALIDACAO_FINAL.md), o
[procedimento de distribuição](DISTRIBUICAO.md) e as [notas da versão](RELEASE_NOTES_1.2.0.md).
