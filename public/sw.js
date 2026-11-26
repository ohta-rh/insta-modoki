// Offline notice only (ADR-0076): the one cached file is the notice page. No page or API response
// is ever stored, so nothing from a signed-in session can be shown to the next person.
const CACHE = 'offline-v1';
const OFFLINE_URL = '/assets/offline.html';

// Workers Static Assets answers /assets/offline.html with a redirect to /assets/offline. A response
// marked `redirected` cannot answer a navigation (the browser fails it), so the stored copy is a
// fresh Response with the same body and headers.
async function cacheOfflinePage() {
  const response = await fetch(OFFLINE_URL);
  if (!response.ok) throw new Error('offline page: ' + response.status);
  const cache = await caches.open(CACHE);
  await cache.put(
    OFFLINE_URL,
    new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheOfflinePage().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  // Any HTTP answer (500 and 404 included) goes through; only a network failure shows the notice.
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
