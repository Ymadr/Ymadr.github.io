const CACHE = 'spendai-v10';
const ASSETS = [
  './',
  './index.html',
  './offline.html',
  './css/app.css',
  './js/db.js',
  './js/ai.js',
  './js/charts.js',
  './js/app.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
];

self.addEventListener('install', e => {
  // Pre-cache all assets and skip waiting so the new SW activates immediately.
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Delete old caches — user data is in localStorage, never touched here.
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// When the app sends SKIP_WAITING, activate the new SW immediately.
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', e => {
  // Cache-first for everything — ensures the app loads on GitHub Pages
  // even if the network request returns a 404 or redirect.
  // Navigation falls back to index.html so the shell always loads.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(r => r || fetch(e.request)).catch(() => caches.match('./offline.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => new Response('Offline', { status: 503, statusText: 'Service Unavailable' })))
  );
});

