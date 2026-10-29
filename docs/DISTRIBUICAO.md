# Distribuição e validação Android

Código 1.3.3, versionCode 12, applicationId com.tutoria.estudos.

## Compilar

Node 22, JDK 21 completo, Android SDK 36 e Build Tools 36.0.0. Definir JAVA_HOME e
ANDROID_HOME.

~~~bash
npm ci
npm run android:sync
cd android
./gradlew --no-daemon :app:assembleDebug :app:assembleDebugAndroidTest
./gradlew --no-daemon :app:connectedDebugAndroidTest
~~~

O último comando requer emulador/dispositivo. Testa o Android Keystore do sistema:
cifragem, IV aleatório, leitura após recriar o cofre, remoção, adulteração e metadados.

## Assinatura

Para instalar as funcionalidades num dispositivo onde já existe o Tutor IA,
compilar a variante separada de teste:

~~~bash
npm run android:sync
npm run android:apk:preview
node scripts/check-apk.mjs android/app/build/outputs/apk/preview/app-preview.apk --preview
~~~

O nome é Tutor IA Teste e a identidade é com.tutoria.estudos.preview. Os dados
desta app são separados dos da instalação atual. Configurar a chave e o PIN nas
suas Definições. O artefacto tutor-ia-teste do CI contém este APK.

A keystore privada original não pertence ao repositório. Uma identidade nova não
permite atualizar a instalação distribuída.

Certificado esperado, extraído do APK release existente:

~~~text
SHA-256: f1892d70aa064c5bcfe2cb1d78e95857f73c324cebd2d7dd858a6084a5de6460
~~~

O verificador compara identidade, versão e este certificado público, fixado em
android/release-certificate.sha256.

Secrets do repositório para o workflow:

- TUTOR_ANDROID_KEYSTORE_BASE64: keystore original codificada em base64;
- TUTOR_ANDROID_STORE_PASSWORD;
- TUTOR_ANDROID_KEY_ALIAS;
- TUTOR_ANDROID_KEY_PASSWORD.

A keystore só é escrita no diretório temporário do runner e removida no fim.
Credenciais são lidas pelo ambiente, sem as incluir no código ou logs.

Localmente, usar TUTOR_ANDROID_KEYSTORE (caminho do ficheiro), e as três variáveis
de palavra-passe/alias indicadas acima.

~~~bash
npm run android:sync
npm run android:apk:release
node scripts/check-apk.mjs android/app/build/outputs/apk/release/app-release.apk
~~~

Sem credenciais, Gradle pode compilar release sem assinatura, para verificar o
código. Esse artefacto não é distribuível como atualização.

## Validar antes de distribuir

Seguir o [guião de validação final](GUIAO_VALIDACAO_FINAL.md) e registar dispositivo,
commit e resultado de cada cenário. O guião inclui a migração da versão 1.1.5 e a
PWA instalada; não considera os testes reais executados antes de haver evidências.

1. Lógica, lint, TypeScript, servidor, HTTP/browser/PWA e export estático.
2. Android: câmara, microfone, leitura, teclado, suspensão e retoma.
3. Chave real: geração, moderação, acesso ao modelo e qualidade das dicas.
4. Esta app e Servidor; HTTPS e opção explícita de HTTP local.
5. Atualização sobre versão antiga com assinatura original; conservar chave,
   conversas e PIN e verificar migração/atrasos depois de reiniciar.
6. Instalação nova e reinstalação sem recuperação automática de segredos.
7. Identidade, versão, assinatura e checksums do APK.

## Preparar distribuição

Executar manualmente Prepare signed Android release, confirmando validação em
dispositivo. O workflow compila, verifica assinatura, gera SHA256SUMS, guarda os
artefactos CI e cria uma release **em rascunho**.

Rever APK, notas e evidências antes de publicar o rascunho. Novos binários ficam
em Releases, sem acrescentar APKs ao histórico Git nem reescrever versões antigas.

Os APKs legados da raiz e releases 1.1.x são artefactos históricos.
