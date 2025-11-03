import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const sanitizeBasePath = (value) => {
  if (!value || value === '/') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, '');
};

const envBasePath = process.env.VITE_BASE_PATH ?? '/quiz';
const basePath = sanitizeBasePath(envBasePath) || '/quiz';
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:4000';

const proxyConfig = {
  '/api': {
    target: proxyTarget,
    changeOrigin: true,
  },
  '/uploads': {
    target: proxyTarget,
    changeOrigin: true,
  },
};

if (basePath) {
  proxyConfig[`${basePath}/api`] = {
    target: proxyTarget,
    changeOrigin: true,
  };
  proxyConfig[`${basePath}/uploads`] = {
    target: proxyTarget,
    changeOrigin: true,
  };
}

export default defineConfig({
  plugins: [react()],
  base: basePath ? `${basePath}/` : '/',
  server: {
    port: 5173,
    open: basePath ? `${basePath}/` : '/',
    proxy: proxyConfig,
  },
  preview: {
    port: 4173,
  },
});
