
const CACHE_NAME = 'my-cards-ai-v8';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  'https://img.icons8.com/fluency/512/wallet.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('SW: Cache addAll warning', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // For navigation requests, adopt a network-first strategy that falls back
  // to the cached index.html for any server errors (like 404) or network failures.
  // This is critical for Single-Page Applications.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If the network provides a valid response, use it.
          // If it's an error (like 404), fall back to the cache.
          return response.ok ? response : caches.match('/index.html');
        })
        .catch(() => {
          // If the network fails completely (offline), serve the cached index.html.
          return caches.match('/index.html');
        })
    );
    return;
  }

  // For all other requests (assets like scripts, styles, images),
  // use a cache-first strategy for performance.
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});