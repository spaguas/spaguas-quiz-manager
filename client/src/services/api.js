import axios from 'axios';
import { AUTH_STORAGE_KEY } from '../utils/storageKeys.js';

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

const envBasePath = import.meta.env.VITE_BASE_PATH ?? '/quiz';
const basePathNormalized = sanitizeBasePath(envBasePath) || '/quiz';
const defaultApiBase = `${basePathNormalized}/api`.replace(/\/{2,}/g, '/') || '/api';
const apiBaseURL = import.meta.env.VITE_API_URL || defaultApiBase;

const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 10000,
});

const adminRoutePrefix = basePathNormalized ? `${basePathNormalized}/admin` : '/admin';
const adminLoginPath = basePathNormalized ? `${basePathNormalized}/admin/login` : '/admin/login';

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      try {
        const session = JSON.parse(raw);
        if (session?.token) {
          config.headers.Authorization = `Bearer ${session.token}`;
        }
      } catch (error) {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined') {
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        if (window.location.pathname.startsWith(adminRoutePrefix)) {
          window.location.href = adminLoginPath;
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;
