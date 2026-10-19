/* Vendo service worker: app-shell offline beschikbaar (network-first met offline-cache),
 * nieuwe versie? Verhoog CACHE. */
const CACHE = 'vendo-app-v3';
const SHELL = [
  './', './index.html', './app.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png',
  '../shared/store.js', '../shared/ui.js', '../shared/vendo.css',
  '../shared/assets/fonts/fonts.css', '../shared/assets/fa/css/all.min.css',
  '../shared/assets/fa/webfonts/fa-solid-900.woff2', '../shared/assets/fa/webfonts/fa-regular-400.woff2',
  '../shared/assets/plan/grp-0.png', '../shared/assets/plan/grp-m.png', '../shared/assets/plan/grp-1.png', '../shared/assets/plan/grp-2.png',
  '../shared/assets/plan/grp-3.png', '../shared/assets/plan/grp-4.png', '../shared/assets/plan/grp-5.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Netwerk eerst (altijd de nieuwste versie), cache als je offline bent
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
