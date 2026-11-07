import { getBackendUrl } from './apiConfig';

const API_BASE_URL = getBackendUrl();

export interface SavedUser {
  id: string;
  name: string;
  mobile: string;
  createdAt: string;
}

export async function saveUserToMongoDB(name: string, mobile: string): Promise<SavedUser> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/auth/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mobile })
    });
  } catch {
    throw new Error('Cannot reach the backend. Make sure it is running and VITE_API_URL is correct.');
  }

  let data: { message?: string; user?: SavedUser } = {};
  try {
    data = await response.json();
  } catch {
    // Keep the HTTP status as the useful error when the server does not return JSON.
  }

  if (!response.ok) {
    throw new Error(data.message || `Could not save your account (HTTP ${response.status}).`);
  }

  if (!data.user) {
    throw new Error('The backend did not return the saved user. Please try again.');
  }

  return data.user;
}
