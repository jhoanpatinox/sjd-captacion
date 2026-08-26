const CACHE_NAME = "sjd-captacion-v2";
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

/* Estrategia: network-first para TODO (API y app shell).
   Si hay conexión, SIEMPRE se usa la versión más reciente publicada
   (en GitHub / Apps Script) y se refresca la caché con esa copia.
   Solo si no hay conexión se usa la última copia guardada localmente.
   Esto evita que un dispositivo quede "pegado" con una versión vieja
   de la app cuando se publica una actualización (el bug que causó que
   Marca de Tarjeta y PasswordHash no se registraran: el equipo seguía
   usando una copia cacheada de antes de esos cambios). */
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
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
