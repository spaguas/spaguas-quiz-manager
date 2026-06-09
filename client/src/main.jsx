import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { preCacheCurrentPageAssets, preCacheOfflineRoutes } from './services/offlineService.js';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const baseUrl = import.meta.env.BASE_URL || '/';
    navigator.serviceWorker.register(`${baseUrl}sw.js`)
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        preCacheOfflineRoutes([
          '/',
          '/play',
          '/leaderboard',
          '/api/quizzes',
          '/api/gamification/leaderboard',
        ]);
        preCacheCurrentPageAssets();
      })
      .catch(() => {});
  });
}
