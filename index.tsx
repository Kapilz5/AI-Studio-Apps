import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');

if (!container) {
  console.error("Root element not found.");
} else {
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    // FIX: Only register Service Worker in production-like environments.
    // Preview environments (like *.usercontent.goog) often redirect static asset requests 
    // to the editor origin, causing "Origin Mismatch" errors.
    const isPreviewEnv = window.location.hostname.includes('usercontent.goog') || 
                         window.location.hostname.includes('webcontainer.io') ||
                         window.location.hostname.includes('stackblitz.io');

    if ('serviceWorker' in navigator && !isPreviewEnv) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
          .then(registration => {
            console.log('SW registered successfully:', registration.scope);
          })
          .catch(registrationError => {
            console.warn('SW registration skipped:', registrationError.message);
          });
      });
    } else if (isPreviewEnv) {
        console.log('Service Worker registration skipped in preview environment.');
    }
  } catch (error) {
    console.error("Render failed:", error);
  }
}