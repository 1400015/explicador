import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
const filename = process.argv[2];
if (!filename) throw new Error("Indica o APK a verificar.");
const buildTools = path.join(
  process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "",
  "build-tools",
  "36.0.0",
);
const metadata = execFileSync(
  path.join(buildTools, "aapt"),
  ["dump", "badging", filename],
  { encoding: "utf8" },
);
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const gradle = await readFile("android/app/build.gradle", "utf8");
const versionCode = gradle.match(/versionCode\s+(\d+)/)?.[1];
if (!versionCode) throw new Error("versionCode Android não encontrado.");
if (
  !metadata.includes("name='com.tutoria.estudos'") ||
  !metadata.includes("versionCode='" + versionCode + "'") ||
  !metadata.includes("versionName='" + version + "'")
)
  throw new Error("Identidade ou versão do APK incorreta.");
const certificate = execFileSync(
  path.join(buildTools, "apksigner"),
  ["verify", "--print-certs", filename],
  { encoding: "utf8" },
);
const digest = certificate
  .match(/certificate SHA-256 digest: ([a-f0-9]+)/i)?.[1]
  ?.toLowerCase();
if (!digest) throw new Error("Não foi possível verificar a assinatura.");
if (!process.argv.includes("--debug")) {
  const expected = (
    await readFile("android/release-certificate.sha256", "utf8")
  ).trim();
  if (digest !== expected)
    throw new Error("A assinatura não corresponde à aplicação já distribuída.");
}
console.log(
  "APK verificado: identidade, versão e assinatura" +
    (process.argv.includes("--debug") ? " de teste." : " original."),
);
