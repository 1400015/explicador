import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.tutoria.estudos",
  appName: "Tutor IA",
  webDir: "out",
  server: {
    // A app Android carrega a interface a partir do servidor Next.js.
    // No telemóvel, o servidor tem de estar acessível na mesma rede Wi-Fi.
    // Descobre o IP do computador com:  (Windows) ipconfig   |   (Mac/Linux) ip addr
    // e troca abaixo pelo IP real, ex.: "http://192.168.1.42:3000"
    // Em produção, aponta para o endereço público/https do teu servidor.
    url: "http://192.168.1.100:3000",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
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
