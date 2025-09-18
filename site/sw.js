// Обновляем версию кэша, чтобы старые кэши были автоматически
// заменены при развертывании новой версии приложения. При
// добавлении новых ассетов нужно увеличивать номер.
const CACHE_NAME = 'bike-app-cache-v4';
const urlsToCache = [
  '/',
  '/index.html',
  '/start.html',
  '/registration.html',
  '/profile.html',
  '/map.html',
  '/stats.html',
  '/investor_home.html',
  '/investor_map.html',
  '/investor_stats.html',
  '/style.css',
  '/blend.css',
  // Prefer lightweight formats for hero image
  '/bike-delivery.avif',
  '/bike-delivery.webp',
  // App icons
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // JS used across pages
  '/menu.js',
  '/transitions.js'
  // Admin assets are not critical for first-load caching
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('Opened cache');
      // Add items individually so one failure doesn't abort the whole install
      await Promise.all(
        urlsToCache.map(url => cache.add(url).catch(err => console.warn('[SW] cache add failed', url, err)))
      );
      self.skipWaiting();
    })
  );
});

// Clean up old caches when a new service worker activates
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('bike-app-cache-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Если есть в кеше, отдаем из кеша
        }
        return fetch(event.request); // Иначе идем в сеть
      })
  );
});
