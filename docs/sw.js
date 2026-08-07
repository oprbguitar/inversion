/* Service worker: hace que el portal funcione sin conexion.
 *
 * Estrategia:
 *   - Mismo origen (app + datos JSON + logos): stale-while-revalidate. Se sirve
 *     lo cacheado al instante y se refresca en segundo plano cuando hay red. Sin
 *     red, se sirve la ultima copia guardada. Se ignora el querystring (?v=, ?t=)
 *     al buscar en cache para que las versiones y el cache-busting no impidan
 *     encontrar el recurso offline.
 *   - Navegacion: si la red falla, se devuelve el index cacheado.
 *   - Origen externo (Twelve Data, YouTube, BCRP, tipo de cambio): no se toca.
 *     Va directo a la red y, sin conexion, cada modulo muestra su estado de
 *     "no disponible". No se cachean cotizaciones: serian datos viejos disfrazados.
 */
const CACHE = 'ahorros-pe-v20260807c';

// Nucleo minimo para el primer arranque offline. El resto de assets se cachea
// solo a medida que la pagina los pide (runtime caching).
const NUCLEO = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/favicon.svg',
  './assets/css/estilos.css',
  './data/dataset.json',
  './data/marcas.json',
  './data/tarjetas.json',
  './data/live.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // Cada recurso por separado: si uno falla (p. ej. live.json aun no existe)
      // no se cae toda la instalacion.
      .then((c) => Promise.allSettled(NUCLEO.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Solo gestionamos mismo origen. Las APIs externas fallan con gracia sin red.
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copia));
          return res;
        })
        .catch(() => caches.match('./index.html', { ignoreSearch: true })),
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cacheado) => {
      const red = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return res;
        })
        .catch(() => cacheado);
      // Se sirve lo cacheado ya mismo; la red refresca la cache para la proxima.
      return cacheado || red;
    }),
  );
});
