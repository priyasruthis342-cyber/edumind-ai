// ─────────────────────────────────────────────────────────────
// groqApi.ts — Fetch helper for EduMind AI Study & Quiz Engine
// Backend endpoint: POST /api/ai/ask (Powered by Google Gemini AI)
// ─────────────────────────────────────────────────────────────

import { getBackendUrl } from './apiConfig';

const BACKEND_URL = getBackendUrl();

export interface QuizItem {
  question: string;
  options: string[];   // e.g. ["A) ...", "B) ...", "C) ...", "D) ..."]
  answer: string;      // e.g. "A"
}

export interface StudyQuizResponse {
  success: boolean;
  summary: string;
  questions: string[];   // 5 important study questions
  answers: string[];     // corresponding 12-mark answers
  quiz: QuizItem[];      // 5 MCQ quiz items
}

// Backward-compatible alias
export type GroqAIResponse = StudyQuizResponse;

/**
 * Send the study text to the Gemini AI backend.
 * Returns AI-generated questions, answers, summary and quiz.
 */
export async function fetchStudyQuizData(prompt: string): Promise<StudyQuizResponse> {
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

  const data: StudyQuizResponse = await response.json();

  if (!data.success) {
    throw new Error('AI service returned an unsuccessful response.');
  }

  return data;
}

// Backward-compatible alias
export const fetchGroqStudyData = fetchStudyQuizData;
