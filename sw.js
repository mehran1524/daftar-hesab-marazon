const CACHE_NAME = 'marazon-classic-personal-v6';
const ASSETS = [
  './', './index.html', './parties.html', './report.html', './style.css',
  './app.js', './db.js', './finance.js', './utils.js', './dates.js', './report.js', './pwa.js', './clock.js',
  './manifest.json', './icon.svg', './marazon-192.png', './marazon-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('boutia-') && key !== CACHE_NAME).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE_NAME).then(async cache => {
    try {
      const response = await fetch(event.request);
      return response.ok ? response : (await cache.match(event.request, { ignoreSearch: true })) || response;
    } catch (error) {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      throw error;
    }
  }));
});
