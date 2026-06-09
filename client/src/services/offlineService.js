const QUIZ_LIST_CACHE_KEY = 'spaguas.quiz.offline.quizList';
const QUIZ_DETAIL_CACHE_PREFIX = 'spaguas.quiz.offline.quiz.';
const SUBMISSION_QUEUE_KEY = 'spaguas.quiz.offline.submissions';
const QUEUE_UPDATED_EVENT = 'spaguas-offline-queue-updated';
const OFFLINE_CACHE_PROGRESS_EVENT = 'spaguas-offline-cache-progress';

const sanitizeBasePath = (value) => {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, '');
};

const basePath = sanitizeBasePath(import.meta.env.VITE_BASE_PATH ?? '/quiz');

const safeParse = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const readStorage = (key, fallback) => {
  if (typeof window === 'undefined') {
    return fallback;
  }
  return safeParse(window.localStorage.getItem(key), fallback);
};

const writeStorage = (key, value) => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
};

const notifyQueueUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(QUEUE_UPDATED_EVENT));
  }
};

export const isOnline = () => (
  typeof navigator === 'undefined' ? true : navigator.onLine
);

export const isNetworkError = (error) => (
  !error?.response && (
    error?.code === 'ERR_NETWORK' ||
    error?.message === 'Network Error' ||
    !isOnline()
  )
);

export const cacheQuizList = (quizzes) => {
  writeStorage(QUIZ_LIST_CACHE_KEY, {
    cachedAt: new Date().toISOString(),
    quizzes,
  });
};

export const getCachedQuizList = () => readStorage(QUIZ_LIST_CACHE_KEY, null);

export const cacheQuizDetail = (quiz) => {
  if (!quiz?.id) {
    return;
  }

  writeStorage(`${QUIZ_DETAIL_CACHE_PREFIX}${quiz.id}`, {
    cachedAt: new Date().toISOString(),
    quiz,
  });
};

export const getCachedQuizDetail = (quizId) =>
  readStorage(`${QUIZ_DETAIL_CACHE_PREFIX}${quizId}`, null);

const normalizeRouteForCache = (route) => {
  if (!route) {
    return basePath || '/';
  }

  if (/^https?:\/\//i.test(route)) {
    return route;
  }

  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
  if (basePath && normalizedRoute.startsWith(`${basePath}/`)) {
    return normalizedRoute;
  }

  return `${basePath}${normalizedRoute}`.replace(/\/{2,}/g, '/');
};

export const preCacheOfflineRoutes = async (routes = []) => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const urls = Array.from(new Set([
    normalizeRouteForCache('/'),
    normalizeRouteForCache('/play'),
    normalizeRouteForCache('/leaderboard'),
    ...routes.map(normalizeRouteForCache),
  ]));

  try {
    const registration = await navigator.serviceWorker.ready;
    const worker = navigator.serviceWorker.controller || registration.active || registration.waiting;
    worker?.postMessage({
      type: 'PRE_CACHE_URLS',
      urls,
    });
  } catch (error) {
    // O cache offline é uma melhoria progressiva; falhas aqui não devem bloquear o quiz.
  }
};

export const subscribeOfflineCacheProgress = (callback) => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }

  const handleMessage = (event) => {
    if (event.data?.type !== 'OFFLINE_CACHE_PROGRESS') {
      return;
    }

    const detail = {
      status: event.data.status,
      total: Number(event.data.total) || 0,
      completed: Number(event.data.completed) || 0,
      failed: Number(event.data.failed) || 0,
      url: event.data.url || '',
    };
    callback(detail);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(OFFLINE_CACHE_PROGRESS_EVENT, { detail }));
    }
  };

  navigator.serviceWorker.addEventListener('message', handleMessage);
  return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
};

export const preCacheCurrentPageAssets = () => {
  if (typeof document === 'undefined') {
    return;
  }

  const urls = [
    ...Array.from(document.querySelectorAll('script[src]')).map((item) => item.src),
    ...Array.from(document.querySelectorAll('link[rel="stylesheet"][href]')).map((item) => item.href),
    ...Array.from(document.querySelectorAll('img[src]')).map((item) => item.currentSrc || item.src),
  ].filter(Boolean);

  return preCacheOfflineRoutes(urls);
};

export const getPendingSubmissions = () => readStorage(SUBMISSION_QUEUE_KEY, []);

const setPendingSubmissions = (items) => {
  writeStorage(SUBMISSION_QUEUE_KEY, items);
  notifyQueueUpdated();
};

export const getPendingSubmissionCount = () => getPendingSubmissions().length;

export const hasPendingSubmissionForEmail = ({ quizId, userEmail }) => {
  const normalizedEmail = (userEmail || '').trim().toLowerCase();
  return getPendingSubmissions().some((item) =>
    Number(item.quizId) === Number(quizId) &&
    (item.payload?.userEmail || '').trim().toLowerCase() === normalizedEmail
  );
};

export const enqueueSubmission = ({ quizId, quizTitle, payload }) => {
  const queuedAt = new Date().toISOString();
  const entry = {
    id: `${quizId}:${payload.userEmail}:${Date.now()}`,
    quizId: Number(quizId),
    quizTitle,
    payload,
    queuedAt,
  };

  setPendingSubmissions([...getPendingSubmissions(), entry]);
  return entry;
};

export const syncPendingSubmissions = async (apiClient) => {
  if (!isOnline()) {
    return { synced: 0, failed: 0, remaining: getPendingSubmissionCount() };
  }

  const queue = getPendingSubmissions();
  const remaining = [];
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await apiClient.post(`/quizzes/${item.quizId}/submissions`, item.payload);
      synced += 1;
    } catch (error) {
      if (error.response && error.response.status < 500) {
        synced += 1;
      } else {
        failed += 1;
        remaining.push(item);
      }
    }
  }

  if (remaining.length !== queue.length) {
    setPendingSubmissions(remaining);
  }

  return { synced, failed, remaining: remaining.length };
};

export { OFFLINE_CACHE_PROGRESS_EVENT, QUEUE_UPDATED_EVENT };
