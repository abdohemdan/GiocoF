const CACHE_NAME = 'giuliokart-v1';
const urlsToCache = [
  '/',
  '/GIOCO.html',
  '/mainj.js',
  '/mappe.js',
  '/crafter.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});