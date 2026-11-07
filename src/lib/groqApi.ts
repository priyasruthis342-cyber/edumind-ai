// ─────────────────────────────────────────────────────────────
// groqApi.ts — Fetch helper for the EduMind Groq AI backend
// Backend endpoint: POST http://localhost:5050/api/ai/ask
// ─────────────────────────────────────────────────────────────

import { getBackendUrl } from './apiConfig';

const BACKEND_URL = getBackendUrl();

export interface QuizItem {
  question: string;
  options: string[];   // e.g. ["A) ...", "B) ...", "C) ...", "D) ..."]
  answer: string;      // e.g. "A"
}

export interface GroqAIResponse {
  success: boolean;
  summary: string;
  questions: string[];   // 5 important study questions
  answers: string[];     // corresponding 12-mark answers
  quiz: QuizItem[];      // 5 MCQ quiz items
}

/**
 * Send the scanned/pasted study text to the Groq Llama backend.
 * Returns AI-generated questions, answers, summary and quiz.
 *
 * @param prompt - The raw study text extracted from the scan
 * @throws Error if the network request fails or the backend returns an error
 */
export async function fetchGroqStudyData(prompt: string): Promise<GroqAIResponse> {
  let response: Response;

  try {
    response = await fetch(`${BACKEND_URL}/api/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
  } catch {
    // Network error — backend is not running or unreachable
    throw new Error(
      'Cannot reach the backend server. Make sure the EduMind backend service is running and accessible.'
    );
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      (errorBody as { message?: string }).message ||
        `Backend error: ${response.status}`
    );
  }

  const data: GroqAIResponse = await response.json();

  if (!data.success) {
    throw new Error('AI service returned an unsuccessful response.');
  }

  return data;
}
