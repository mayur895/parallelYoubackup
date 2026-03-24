// ============================================================
// ParallelYou — Service Worker
// Strategy: Cache-first for static assets & WASM, Network-first for API
// ============================================================

const CACHE_NAME = 'parallelyou-v1';
const OFFLINE_URL = '/offline.html';

// Assets to pre-cache on install (app shell + WASM engines)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
];

// ---- Install: pre-cache shell ----
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Pre-cache partial failure (ok on first install):', err);
      });
    })
  );
  self.skipWaiting();
});

// ---- Activate: clean old caches ----
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ---- Fetch: smart routing ----
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin API calls (Gemini, HuggingFace download)
  if (request.method !== 'GET') return;

  // Gemini API → always network (never cache)
  if (url.hostname.includes('generativelanguage.googleapis.com')) return;

  // HuggingFace model downloads → network only (SDK handles OPFS caching itself)
  if (url.hostname.includes('huggingface.co')) return;

  // WASM / JS bundles → cache-first
  if (
    url.pathname.endsWith('.wasm') ||
    url.pathname.endsWith('.js') ||
    url.pathname.includes('/assets/')
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else (HTML, CSS, fonts) → stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ---- Cache Strategies ----

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline — asset not cached', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || fetchPromise || offlineFallback();
}

async function offlineFallback() {
  const cached = await caches.match(OFFLINE_URL);
  return cached || new Response('<h1>You are offline</h1>', {
    headers: { 'Content-Type': 'text/html' },
  });
}

// ---- Listen for skip-waiting message ----
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
