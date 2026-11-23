import { getBackendUrl } from './apiConfig';

const API_BASE_URL = getBackendUrl();

export interface SavedUser {
  id: string;
  name: string;
  mobile: string;
  createdAt: string;
}

export async function saveUserToMongoDB(name: string, mobile: string): Promise<SavedUser> {
  const fallbackUser: SavedUser = {
    id: 'user_' + Date.now().toString(36),
    name,
    mobile,
    createdAt: new Date().toISOString()
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mobile }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      if (data && data.user) {
        return data.user;
      }
    }
  } catch (err) {
    console.warn('Backend user registration sync note (optimistic local login used):', err);
  } finally {
    clearTimeout(timeoutId);
  }

  return fallbackUser;
}
