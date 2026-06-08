const CACHE_NAME = 'spaguas-quiz-offline-v1';
const APP_SHELL = ['./'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

const isCacheableRequest = (request) => {
  if (request.method !== 'GET') {
    return false;
  }

  const url = new URL(request.url);
  return (
    request.mode === 'navigate' ||
    url.pathname.includes('/api/quizzes') ||
    url.pathname.includes('/assets/') ||
    url.pathname.includes('/uploads/')
  );
};

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (!isCacheableRequest(request)) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }

        if (request.mode === 'navigate') {
          return caches.match('./');
        }

        throw new Error('Offline and no cached response available.');
      }),
  );
});
