import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/index.css';

// ── Service Worker Registration ──────────────────────────────────────────────
// Registers sw.js for offline caching of the app shell + WASM assets.
// Only active in production-like environments (Vite dev mode uses HMR instead).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[SW] Registered:', reg.scope);

      // Prompt user to reload when a new SW version is waiting
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] New version available — refresh to update.');
          }
        });
      });
    } catch (err) {
      console.warn('[SW] Registration failed:', err);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
