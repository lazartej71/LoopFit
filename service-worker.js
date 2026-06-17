/*
  service-worker.js
  =================
  El Service Worker es un "ayudante" que corre en segundo plano y permite:
  - Que la app funcione sin internet (offline).
  - Que se instale como app (PWA).
  - Que se actualice sola cuando subís una versión nueva.

  ESTRATEGIA DE CACHÉ (importante para que se actualice solo):
  - HTML, CSS y JS  -> "red primero": si hay internet, siempre traemos lo último.
                       Si no hay internet, usamos lo guardado (offline).
  - .wasm y sql-wasm.js (archivos grandes que casi nunca cambian)
                    -> "caché primero": los guardamos y no los volvemos a bajar.

  Así, cada vez que subís cambios a Vercel y abrís la app con internet, ves la
  versión nueva sin tener que reinstalar nada ni borrar la caché a mano.

  VERSIÓN: cuando hagas un cambio grande (sobre todo si cambia el .wasm), subí
  este número (v1 -> v2). Al cambiar, se borra la caché vieja automáticamente.
*/

const VERSION = "v1";
const CACHE = "gymtrack-" + VERSION;

// Archivos que guardamos al instalar, para que la app abra incluso sin internet.
const ARCHIVOS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/db.js",
  "./js/ui.js",
  "./js/rutinas.js",
  "./js/registro.js",
  "./js/pr.js",
  "./js/app.js",
  "./assets/sql-wasm.js",
  "./assets/sql-wasm.wasm",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// ---------- INSTALACIÓN: guardamos los archivos en la caché. ----------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ARCHIVOS))
  );
  // No esperamos a que se cierren las pestañas para activar la versión nueva.
  // (Igual, el control real lo toma cuando el usuario toca "Actualizar".)
});

// ---------- ACTIVACIÓN: borramos las cachés viejas. ----------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nombres) =>
        Promise.all(
          nombres
            .filter((n) => n.startsWith("gymtrack-") && n !== CACHE)
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim()) // Tomamos el control de las pestañas abiertas.
  );
});

// ---------- MENSAJES desde la app (para actualizar al instante). ----------
self.addEventListener("message", (event) => {
  if (event.data && event.data.tipo === "SKIP_WAITING") {
    self.skipWaiting(); // Activamos la versión nueva ya mismo.
  }
});

// ---------- Estrategias de caché ----------

// "Red primero": intentamos la red; si funciona, guardamos copia y la devolvemos.
// Si falla (sin internet), devolvemos lo que tengamos guardado.
async function redPrimero(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresca = await fetch(request);
    if (fresca && fresca.ok) cache.put(request, fresca.clone());
    return fresca;
  } catch (e) {
    const cacheada = await cache.match(request);
    if (cacheada) return cacheada;
    // Si era una navegación (abrir la app), devolvemos el index guardado.
    if (request.mode === "navigate") {
      return cache.match("./index.html");
    }
    throw e;
  }
}

// "Caché primero": si lo tenemos guardado lo devolvemos; si no, lo bajamos.
async function cachePrimero(request) {
  const cache = await caches.open(CACHE);
  const cacheada = await cache.match(request);
  if (cacheada) return cacheada;
  const fresca = await fetch(request);
  if (fresca && fresca.ok) cache.put(request, fresca.clone());
  return fresca;
}

// ---------- FETCH: cada vez que la app pide un archivo, decidimos qué hacer. ----------
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Solo nos metemos con peticiones GET.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Solo manejamos archivos de nuestro propio sitio. Lo externo pasa de largo.
  if (url.origin !== self.location.origin) return;

  // Archivos pesados que casi no cambian -> caché primero.
  if (url.pathname.endsWith(".wasm") || url.pathname.endsWith("sql-wasm.js")) {
    event.respondWith(cachePrimero(req));
    return;
  }

  // Todo lo demás (HTML, CSS, JS, íconos) -> red primero.
  event.respondWith(redPrimero(req));
});
