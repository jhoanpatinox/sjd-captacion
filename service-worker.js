const CACHE_NAME = "sjd-captacion-v1";
const APP_SHELL = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Estrategia: network-first para la API (para no servir datos viejos cuando
   hay conexión), cache-first para el resto del "app shell" (para que la
   app cargue instantáneamente sin conexión). */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  const isApi = url.hostname.includes("script.google.com");
  if (isApi) {
    event.respondWith(
      fetch(req).catch(() => new Response(
        JSON.stringify({ ok: false, error: "offline" }),
        { headers: { "Content-Type": "application/json" } }
      ))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      return (
        cached ||
        fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            return res;
          })
          .catch(() => cached)
      );
    })
  );
});
