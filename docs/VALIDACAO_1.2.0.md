# Validação local da versão 1.2.0

Atualizado em 28/10/2026. Implementação das etapas 1–8 do plano preparada localmente.
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
| npm audit | 0 vulnerabilidades reportadas |
| YAML dos workflows e sintaxe shell | Verificados localmente |

Os testes web usam Chromium e Gemini simulada, carregada apenas pelo processo de
testes. Não houve pedidos de geração com credenciais reais. Android foi compilado
com Java 21 e SDK/Build Tools 36.

## Validação ainda necessária

- **Testes instrumentados Android:** quatro testes do cofre e dos metadados foram
  compilados. A execução no emulador local sem aceleração foi iniciada, mas ficou
  sem resultado confirmado após o reinício do ambiente. Não se considera aprovada.
  O job Android do CI está preparado para os executar num emulador com KVM.
- **Gemini real:** geração, moderação, acesso ao modelo e qualidade pedagógica.
- **Android físico:** dois modos de ligação, câmara, microfone, leitura, teclado,
  suspensão/retoma e persistência.
- **Atualização assinada:** usar a keystore original e verificar migração da chave,
  conversas e PIN sobre a instalação distribuída.
- **CI remoto:** os workflows foram preparados, mas ainda não foram executados
  no GitHub com estas alterações.

O APK debug serve para uma instalação de teste. Não atualiza a app release
distribuída. O build release sem assinatura comprova a compilação, mas não é uma
atualização distribuível.

Ver [procedimento de distribuição](DISTRIBUICAO.md) e [notas da versão](RELEASE_NOTES_1.2.0.md).
