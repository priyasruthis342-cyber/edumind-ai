/**
 * Centralized API configuration for EduMind AI Frontend.
 * Resolves the backend API URL dynamically via VITE_API_URL.
 */
export function getBackendUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

  // If VITE_API_URL is configured, use it directly (stripping trailing slash)
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  // Fallback: in local development, default to local backend on port 5050
  if (import.meta.env.DEV) {
    return 'http://localhost:5050';
  }

  // In production without VITE_API_URL, fallback to relative path (same-origin /api)
  return '';
}

