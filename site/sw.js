// Обновляем версию кэша, чтобы старые кэши были автоматически
// заменены при развертывании новой версии приложения. При
// добавлении новых ассетов нужно увеличивать номер.
const CACHE_NAME = 'bike-app-cache-v2';
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
