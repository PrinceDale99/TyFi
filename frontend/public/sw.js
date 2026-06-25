// Service worker for offline map caching
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('map-tiles').then((cache) => {
      return cache.addAll(['/offline-map.html']);
    })
  );
});
