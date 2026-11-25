// Offline notice only (ADR-0076): the one cached file is the notice page. No page or API response
// is ever stored, so nothing from a signed-in session can be shown to the next person.
const CACHE = 'offline-v1';
const OFFLINE_URL = '/assets/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  // Any HTTP answer (500 and 404 included) goes through; only a network failure shows the notice.
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
