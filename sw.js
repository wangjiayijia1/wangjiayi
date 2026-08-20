// Service Worker - 太化价格看板 PWA
// Cache strategy: stale-while-revalidate for data, cache-first for static assets

const CACHE_VERSION = 'th-priceboard-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './data.json',
  './price_history.json'
];

// Install: pre-cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // Use addAll with individual fallbacks to avoid full failure
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url))
      ).then(() => self.skipWaiting());
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: stale-while-revalidate
self.addEventListener('fetch', event => {
  const request = event.request;
  
  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // For data files (data.json, price_history.json): network-first with cache fallback
  if (url.pathname.endsWith('data.json') || url.pathname.endsWith('price_history.json')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone and cache the fresh response
          const cloned = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, cloned));
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request).then(cached => {
            if (cached) {
              // Add header to indicate offline data
              const body = cached.body;
              const headers = new Headers(cached.headers);
              headers.set('X-Served-From', 'cache-offline');
              return new Response(body, { status: cached.status, statusText: cached.statusText, headers });
            }
            return new Response('{"error":"offline"}', { status: 503, headers: { 'Content-Type': 'application/json' } });
          });
        })
    );
    return;
  }

  // For everything else: cache-first, then network
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Revalidate in background
        fetch(request).then(response => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, cloned));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(request).then(response => {
        if (response.ok && response.type === 'basic') {
          const cloned = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, cloned));
        }
        return response;
      });
    })
  );
});

// Listen for messages from page (e.g., manual cache clear)
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
