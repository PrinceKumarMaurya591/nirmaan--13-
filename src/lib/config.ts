/**
 * API Configuration for Nirmaan App
 * 
 * For Capacitor (Android/iOS) builds, the app needs to know
 * the production server URL to make API calls, since the web
 * assets are loaded from the device's local filesystem.
 * 
 * Set VITE_API_URL in your .env.production file to the
 * production server URL (e.g., http://13.127.89.22:3000)
 */

// Try to get from Vite env, fallback to empty string (same-origin)
const VITE_API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';

/**
 * Returns the full API URL for the given path.
 * - If VITE_API_URL is set (production/Capacitor build), prepends it.
 * - Otherwise, returns the relative path (dev server / same-origin).
 */
export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (VITE_API_URL) {
    // Ensure no double slashes
    const base = VITE_API_URL.replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
  }
  return path;
}

/**
 * Returns the configured API base URL (without trailing slash).
 */
export function getApiBaseUrl(): string {
  return VITE_API_URL || '';
}

/**
 * Detects if the app is running inside Capacitor (native mobile).
 */
export function isNativePlatform(): boolean {
  try {
    return !!(window as any).Capacitor?.isNativePlatform();
  } catch {
    return false;
  }
}
