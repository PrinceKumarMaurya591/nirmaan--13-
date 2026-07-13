
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
