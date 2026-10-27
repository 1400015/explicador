/* Gerado pelo build. Apenas o shell desta versão e os seus recursos imutáveis. */
const BUILD_ID = "__BUILD_ID__";
const PRECACHE = __PRECACHE__;
const CACHE = "tutor-ia-precache-" + BUILD_ID;
const READY = "/__tutor_precache_complete__";
const ALLOWED = new Set(PRECACHE);
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        for (const path of PRECACHE) {
          const response = await fetch(
            new Request(path, {
              cache: "reload",
              credentials: "same-origin",
              redirect: "error",
            }),
          );
          if (!response.ok || response.type === "opaque")
            throw new Error("Instalação incompleta");
          await cache.put(path, response);
        }
        await cache.put(READY, new Response(BUILD_ID));
      } catch (error) {
        await caches.delete(CACHE);
        throw error;
      }
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING")
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE);
        const windows = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        if (
          windows.filter((client) =>
            client.url.startsWith(self.registration.scope),
          ).length > 1
        ) {
          event.source?.postMessage({ type: "UPDATE_BLOCKED" });
          return;
        }
        if (await cache.match(READY)) await self.skipWaiting();
      })(),
    );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      if (!(await cache.match(READY))) throw new Error("Cache incompleta");
      for (const name of await caches.keys()) {
        if (
          (name.startsWith("tutor-ia-precache-") || name === "tutor-ia-v1") &&
          name !== CACHE
        )
          await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.search ||
    request.headers.has("rsc") ||
    !ALLOWED.has(url.pathname)
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(url.pathname);
      return cached || fetch(request);
    })(),
  );
});
