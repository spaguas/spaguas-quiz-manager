const CACHE_NAME = 'spaguas-quiz-offline-v2';
const APP_SCOPE = self.registration.scope;
const APP_SHELL = [
  APP_SCOPE,
  new URL('index.html', APP_SCOPE).href,
];

const isSameOrigin = (url) => url.origin === self.location.origin;

const isInsideScope = (url) => url.href.startsWith(APP_SCOPE);

const notifyClient = (clientId, payload) => {
  if (!clientId) {
    return;
  }

  self.clients.get(clientId).then((client) => {
    client?.postMessage(payload);
  });
};

const cacheRequest = async (cache, request) => {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return null;
  }
};

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

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'PRE_CACHE_URLS') {
    return;
  }

  const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cacheUrls = urls
        .map((value) => new URL(value, APP_SCOPE))
        .filter((url) => isSameOrigin(url) && isInsideScope(url));
      const total = cacheUrls.length;
      let completed = 0;
      let failed = 0;

      notifyClient(event.source?.id, {
        type: 'OFFLINE_CACHE_PROGRESS',
        status: 'started',
        total,
        completed,
        failed,
      });

      await Promise.allSettled(
        cacheUrls.map(async (url) => {
          const response = await cacheRequest(cache, new Request(url.href, { method: 'GET' }));
          completed += 1;
          if (!response?.ok) {
            failed += 1;
          }
          notifyClient(event.source?.id, {
            type: 'OFFLINE_CACHE_PROGRESS',
            status: completed >= total ? 'completed' : 'progress',
            total,
            completed,
            failed,
            url: url.href,
          });
        }),
      );
    }),
  );
});

const isCacheableRequest = (request) => {
  if (request.method !== 'GET') {
    return false;
  }

  const url = new URL(request.url);
  if (!isSameOrigin(url)) {
    return false;
  }

  return (
    request.mode === 'navigate' ||
    url.pathname.includes('/api/quizzes') ||
    url.pathname.includes('/assets/') ||
    url.pathname.includes('/uploads/')
  );
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode !== 'navigate' || !isSameOrigin(url) || !isInsideScope(url)) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
            cache.addAll(APP_SHELL).catch(() => {});
          });
        }
        return response;
      })
      .catch(async () => {
        const cachedRoute = await caches.match(request);
        if (cachedRoute) {
          return cachedRoute;
        }

        const cachedShell = await caches.match(APP_SCOPE) || await caches.match(new URL('index.html', APP_SCOPE).href);
        if (cachedShell) {
          return cachedShell;
        }

        throw new Error('Offline and no cached app shell available.');
      }),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === 'navigate' || !isCacheableRequest(request)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      if (url.pathname.includes('/assets/')) {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
      }

      try {
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }

        throw new Error('Offline and no cached response available.');
      }
    }),
  );
});
