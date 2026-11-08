/**
 * Centralized API configuration for EduMind AI Frontend.
 * Resolves the backend API URL dynamically via VITE_API_URL with graceful cloud fallback.
 */
export function getBackendUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

  // 1. If VITE_API_URL is configured with a valid HTTP(S) URL, use it
  if (envUrl && /^https?:\/\//i.test(envUrl)) {
    // If in production build running in a browser, prevent accidental localhost calls
    if (import.meta.env.PROD && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return 'https://edumind-backend.onrender.com';
    }
    return envUrl.replace(/\/+$/, '');
  }

  // 2. In local development, default to local backend on port 5050
  if (import.meta.env.DEV) {
    return 'http://localhost:5050';
  }

  // 3. In cloud production deployment (e.g. Vercel), default to the deployed Render backend
  // to avoid 404 errors on relative /api paths
  return 'https://edumind-backend.onrender.com';
}
