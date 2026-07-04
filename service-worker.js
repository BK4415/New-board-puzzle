/**
 * Board Puzzle — Service Worker
 * Caches all assets for complete offline use.
 * Cache-first strategy: serve from cache, fall back to network.
 */

const CACHE_NAME = 'board-puzzle-v1.0.0';

const ASSETS_TO_CACHE = [
  '/index.html',
  '/game.html',
  '/about.html',
  '/guide.html',
  '/policy.html',
  '/css/style.css',
  '/css/game.css',
  '/css/popup.css',
  '/js/app.js',
  '/js/game.js',
  '/js/board.js',
  '/js/image.js',
  '/js/animation.js',
  '/js/storage.js',
  '/js/dashboard.js',
  '/js/popup.js',
  '/js/sound.js',
  '/assets/logo.png',
  '/assets/preset-1.jpg',
  '/assets/preset-2.jpg',
  '/assets/preset-3.jpg',
  '/assets/preset-4.jpg',
  '/assets/preset-5.jpg',
  '/assets/trophy.png',
  '/assets/move.wav',
  '/assets/click.wav',
  '/manifest.json',
];

/* ── Install: pre-cache all assets ──────────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Pre-cache partial failure:', err);
      });
    })
  );
  self.skipWaiting(); // activate immediately
});

/* ── Activate: remove old caches ────────────────────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim(); // take control of open clients
});

/* ── Fetch: cache-first strategy ────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests for same-origin resources
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      // Not in cache — try network, then cache for next time
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});
