import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const isStatic = process.argv.includes("--static");
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  {
    stdio: "inherit",
    env: { ...process.env, TUTOR_IA_STATIC: isStatic ? "1" : "0" },
  },
);
const code = await new Promise((resolve) => child.on("exit", resolve));
if (code !== 0) process.exit(code ?? 1);
async function files(directory) {
  const list = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) list.push(...(await files(filename)));
    else list.push(filename);
  }
  return list;
}
const assets = (await files(".next/static"))
  .filter((name) => /\.(js|css|woff2)$/.test(name))
  .map(
    (name) =>
      "/_next/static/" +
      path.relative(".next/static", name).split(path.sep).join("/"),
  )
  .sort();
const publicAssets = (await files("public/icons"))
  .filter((name) => /\.(png|svg|webp|ico)$/.test(name))
  .map(
    (name) =>
      "/" +
      name
        .split(path.sep)
        .join("/")
        .replace(/^public\//, ""),
  );
const precache = ["/", "/manifest.webmanifest", ...publicAssets, ...assets];
const template = await readFile("scripts/service-worker.js", "utf8");
const id = createHash("sha256")
  .update(await readFile(".next/BUILD_ID"))
  .update(template)
  .update(JSON.stringify(precache))
  .digest("hex")
  .slice(0, 24);
const worker = template
  .replace('"__BUILD_ID__"', JSON.stringify(id))
  .replace("__PRECACHE__", JSON.stringify(precache));
await mkdir("public", { recursive: true });
await writeFile("public/sw.js.tmp", worker);
await rename("public/sw.js.tmp", "public/sw.js");
if (isStatic) {
  await writeFile("out/sw.js", worker);
}
console.log("PWA preparada: " + precache.length + " recursos, versão " + id);
