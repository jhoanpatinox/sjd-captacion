const CACHE_NAME = "sjd-captacion-v2";
const APP_SHELL = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./logo.png",
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

/* Estrategia de red:
   - API (Google Apps Script): siempre red primero, nunca caché, para no
     mostrar datos financieros desactualizados.
   - HTML / manifest (el "código" de la app): SIEMPRE red primero. Así,
     cada vez que se sube una corrección a GitHub, el celular la recibe de
     inmediato en cuanto haya conexión, en lugar de quedarse pegado en una
     versión vieja guardada en caché. Solo se usa la copia en caché como
     respaldo si el dispositivo está realmente sin conexión.
   - Íconos/imágenes: caché primero (no cambian casi nunca, así cargan
     instantáneo y ahorran datos). */
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

  const isAppShellCode = req.mode === "navigate" ||
    url.pathname.endsWith("index.html") ||
    url.pathname.endsWith("manifest.json") ||
    url.pathname === "/" ||
    url.pathname.endsWith("/");

  if (isAppShellCode) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Imágenes y otros recursos estáticos: caché primero.
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
