/* Stargaze service worker — offline shell + static asset cache */
const CACHE = 'stargaze-v3';
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
  '/calendar',
  '/aurora',
  '/planets',
  '/iss',
  '/game',
  '/news',
  '/gear',
  '/sky',
  '/live',
  '/globe',
  '/about',
  '/settings',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only same-origin
  if (url.origin !== self.location.origin) return;

  // Navigation: network-first, fall back to cache / offline shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const shell = await caches.match('/') || await caches.match('/index.html');
          return shell || new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Stargaze Offline</title><style>body{background:#030014;color:#fff;font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px}h1{font-size:1.5rem}p{opacity:.6}</style></head><body><div><h1>You\'re offline</h1><p>Stargaze needs a connection for live space data.<br>Cached pages may still work.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // Static assets: cache-first
  if (url.pathname.startsWith('/assets/') || /\.(js|css|png|svg|jpg|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        });
      })
    );
  }
});
