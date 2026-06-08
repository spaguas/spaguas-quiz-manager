const QUIZ_LIST_CACHE_KEY = 'spaguas.quiz.offline.quizList';
const QUIZ_DETAIL_CACHE_PREFIX = 'spaguas.quiz.offline.quiz.';
const SUBMISSION_QUEUE_KEY = 'spaguas.quiz.offline.submissions';
const QUEUE_UPDATED_EVENT = 'spaguas-offline-queue-updated';

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

export { QUEUE_UPDATED_EVENT };
