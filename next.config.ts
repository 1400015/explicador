import type { NextConfig } from "next";

// Quando TUTOR_IA_STATIC=1 (build para o APK Android), gera export estático em ./out
// (interface embutida na app, sem servidor). A rota /api/chat continua disponível
// no build normal de servidor (npm run build / npm start).
const isStatic = process.env.TUTOR_IA_STATIC === "1";

const nextConfig: NextConfig = {
  /* config options here */
  // PPR / cacheComponents não são compatíveis com export estático (modo APK).
  ...(isStatic
    ? { output: "export" as const, images: { unoptimized: true } }
    : { cacheComponents: true, partialPrefetching: true }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
