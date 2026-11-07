/**
 * Centralized API configuration for EduMind AI.
 * Handles dynamic API routing for both local development and cloud production deployment.
 */

/**
 * Returns the resolved backend URL:
 * - If VITE_API_URL is set to a cloud URL (e.g. https://edumind-backend.onrender.com), uses it.
 * - If running in production (PROD) and VITE_API_URL is empty or defaults to localhost,
 *   falls back to '' (same-origin relative path /api/...) to prevent phone/browser localhost errors.
 * - If running in development (DEV), falls back to 'http://localhost:5050'.
 */
export function getBackendUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

  if (envUrl) {
    // If deployed to production, prevent accidental fallback to client's own localhost
    if (import.meta.env.PROD && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return '';
    }
    return envUrl.replace(/\/+$/, '');
  }

  return import.meta.env.PROD ? '' : 'http://localhost:5050';
}

