const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const BASE = '__BASE__';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(`blind-timer-${VERSION}`)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== `blind-timer-${VERSION}`)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const url = new URL(event.request.url);

  if (url.pathname === `${BASE}/` || url.pathname === `${BASE}` || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(`${BASE}/`)).then((response) => response ?? caches.match(`${BASE}/`)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(`blind-timer-${VERSION}`).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      });
    }),
  );
});
