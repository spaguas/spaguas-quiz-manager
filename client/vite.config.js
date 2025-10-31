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

const basePath = sanitizeBasePath(process.env.VITE_BASE_PATH);
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  base: basePath ? `${basePath}/` : '/',
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
  },
});
