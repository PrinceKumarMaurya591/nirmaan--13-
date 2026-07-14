
// ============================================================
// 📱 Capacitor Native API Redirect
// When running inside Android APK (Capacitor), all /api/* fetch
// calls must be redirected to the production server because the
// web assets are loaded from the local filesystem (file://).
// ============================================================
import { getApiUrl, isNativePlatform } from './lib/config';

if (isNativePlatform()) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;
    if (typeof input === 'string') {
      url = getApiUrl(input);
      return originalFetch(url, init);
    } else if (input instanceof Request) {
      url = getApiUrl(input.url);
      const modifiedRequest = new Request(url, input);
      return originalFetch(modifiedRequest, init);
    } else if (input instanceof URL) {
      url = getApiUrl(input.toString());
      return originalFetch(url, init);
    }
    return originalFetch(input, init);
  };
  console.log('[Capacitor] API redirect enabled ->', getApiUrl('/api'));
}

// Global error tracker
window.addEventListener("error", (event) => {
  try {
    const userPhone = localStorage.getItem('userPhone') || 'unknown';
    const userPin = localStorage.getItem('userPin') || '';
    const tenantId = localStorage.getItem('tenantId') || '';
    
    const headers = { 'Content-Type': 'application/json' };
    if (userPhone && userPin) {
       headers['x-user-phone'] = userPhone;
       headers['x-user-pin'] = userPin;
       headers['x-tenant-id'] = tenantId;
    }
    const token = localStorage.getItem('authToken');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    fetch('/api/errors', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        errorMessage: event.message,
        errorStack: event.error?.stack || 'No stack trace',
        component: 'GlobalWindowError',
        url: window.location.href,
        browserInfo: navigator.userAgent
      })
    }).catch(() => {});
  } catch (e) {}
});

window.addEventListener("unhandledrejection", (event) => {
  try {
    const userPhone = localStorage.getItem('userPhone') || 'unknown';
    const userPin = localStorage.getItem('userPin') || '';
    const tenantId = localStorage.getItem('tenantId') || '';
    
    const headers = { 'Content-Type': 'application/json' };
    if (userPhone && userPin) {
       headers['x-user-phone'] = userPhone;
       headers['x-user-pin'] = userPin;
       headers['x-tenant-id'] = tenantId;
    }
    const token = localStorage.getItem('authToken');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    fetch('/api/errors', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        errorMessage: typeof event.reason === 'string' ? event.reason : (event.reason?.message || 'Unhandled Promise Rejection'),
        errorStack: event.reason?.stack || 'No stack trace',
        component: 'UnhandledRejection',
        url: window.location.href,
        browserInfo: navigator.userAgent
      })
    }).catch(() => {});
  } catch (e) {}
});

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Unregister any existing service workers if in development to avoid caching issues
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
      registration.unregister();
    }
  });
}

// Register service worker for offline support
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('New content available, please refresh.');
  },
  onOfflineReady() {
    console.log('App is ready to work offline.');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
);
