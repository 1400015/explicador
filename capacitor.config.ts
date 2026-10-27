import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tutoria.estudos",
  appName: "Tutor IA",
  // A interface da app é embutida no APK (export estático em ./out) —
  // não é preciso servidor nenhum para abrir a app.
  webDir: "out",
  loggingBehavior: "none",
  android: {
    loggingBehavior: "none",
    // cleartext (HTTP) só é necessário se o utilizador ligar a app a um
    // servidor local na rede Wi-Fi (modo "Servidor" nas Definições).
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#4f46e5",
      showSpinner: false,
    },
  },
};

export default config;
