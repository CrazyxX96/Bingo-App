// sw.js
const CACHE_NAME = 'bingo-ocr-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-256.png',
  './assets/icons/icon-384.png',
  './assets/icons/icon-512.png'
];

// Install: App-Shell vorcachen
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: alte Caches aufräumen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Fetch: Cache-first für App-Shell; sonst Network-first mit sanftem Fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Nur GET cachen
  if (request.method !== 'GET') return;

  event.respondWith((async () => {
    const url = new URL(request.url);

    // Für unsere eigenen relativen Pfade -> Cache-first
    const isSameOrigin = url.origin === self.location.origin;
    if (isSameOrigin) {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const resp = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        // Klonen, dann speichern
        cache.put(request, resp.clone());
        return resp;
      } catch {
        // Offline-Fallback für Root
        if (request.destination === 'document') {
          return caches.match('./index.html');
        }
        throw;
      }
    }

    // Für Fremd-Domains (z.B. CDN von Tesseract): network-first,
    // nicht aggressiv cachen (Opaque-Responses etc.)
    try {
      return await fetch(request);
    } catch {
      // Kein Fallback möglich (z.B. Tesseract-Worker offline)
      // Liefere wenigstens etwas, falls eine Seite angefragt wurde:
      if (request.destination === 'document') {
        return caches.match('./index.html');
      }
      throw;
    }
  })());
});
