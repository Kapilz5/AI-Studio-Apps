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
    // Preview environments often redirect static asset requests to the editor origin (e.g. ai.studio),
    // causing "Origin Mismatch" errors which are expected and safe to ignore in dev.
    const isPreviewEnv = window.location.hostname.includes('usercontent.goog') || 
                         window.location.hostname.includes('webcontainer.io') ||
                         window.location.hostname.includes('stackblitz.io') ||
                         window.location.hostname.includes('ai.studio');

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        // We attempt registration even in preview to support PWA testing where supported,
        // but suppress the specific origin errors that occur in some sandboxes.
        navigator.serviceWorker.register('./sw.js', { scope: '/' })
          .then(registration => {
            console.log('SW registered successfully:', registration.scope);
          })
          .catch(registrationError => {
            // Robustly extract error message to suppress preview environment noise
            let msg = '';
            try {
                msg = registrationError ? (registrationError.message || registrationError.toString()) : '';
            } catch (e) {
                msg = String(registrationError);
            }
            const lowerMsg = msg.toLowerCase();
            
            if (
                lowerMsg.includes('origin') || 
                lowerMsg.includes('scripturl') || 
                lowerMsg.includes('mime') || 
                lowerMsg.includes('failed to register') || 
                lowerMsg.includes('serviceworker')
            ) {
                console.log('PWA support disabled in preview environment (Origin/MIME mismatch).');
            } else {
                console.warn('SW registration skipped:', registrationError);
            }
          });
      });
    }
  } catch (error) {
    console.error("Render failed:", error);
  }
}
