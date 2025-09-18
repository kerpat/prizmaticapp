// Обновляем версию кэша, чтобы старые кэши были автоматически
// заменены при развертывании новой версии приложения. При
// добавлении новых ассетов нужно увеличивать номер.
const CACHE_NAME = 'bike-app-cache-v3';
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
  '/bike-delivery.png',
  '/bike-delivery.webp',
  '/bike-delivery.avif',
  '/bike00001.png',
  '/avatar.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
  ,'/menu.js'
  ,'/admin.html'
  ,'/admin.js'
  ,'/admin.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Clean up old caches when a new service worker activates
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('bike-app-cache-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
    ))
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
