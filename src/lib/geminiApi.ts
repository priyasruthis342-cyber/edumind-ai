// ─────────────────────────────────────────────────────────────
// geminiApi.ts — Frontend client for Google Gemini AI routes
// Connects to /api/gemini/exam-qa and /api/gemini/story-convert
// ─────────────────────────────────────────────────────────────

import { getBackendUrl } from './apiConfig';
import { cleanMathFormatting } from './mathFormatter';

const BACKEND_URL = getBackendUrl();

export interface QuestionSimple {
  id: number;
  question: string;
  answer: string;
  importance_stars?: number;
  priority_tag?: string;
}

export interface Question8MarkAnswer {
  definition?: string;
  architecture_structure?: string;
  operations?: string;
  program_code?: string;
  program_output?: string;
  advantages_disadvantages?: string;
}

export interface Question8Mark {
  id: number;
  question: string;
  importance_stars?: number;
  priority_tag?: string;
  answer: string | Question8MarkAnswer;
}

export interface Question12Mark {
  id: number;
  question: string;
  importance_stars?: number;
  priority_tag?: string;
  answer: {
    // Comprehensive Professional University Exam Sheet Structure
    introduction?: string;
    architecture_types?: string;
    operations?: string;
    concrete_example?: string;
    program_code?: string;
    program_output?: string;
    numerical_problem?: string;
    tradeoffs_complexity?: string;
    // Legacy compatibility fields
    headings?: Array<{
      title: string;
      content: string;
    }>;
    examples?: string;
    conclusion?: string;
  };
}

export interface GeminiExamQAResponse {
  success: boolean;
  provider: string;
  chapter_title: string;
  summary: string;
  questions_1mark?: QuestionSimple[];
  questions_2mark: QuestionSimple[];
  questions_3mark: QuestionSimple[];
  questions_5mark?: QuestionSimple[];
  questions_8mark?: Question8Mark[];
  questions_12mark: Question12Mark[];
}

export interface GeminiStoryResponse {
  success: boolean;
  provider: string;
  title: string;
  simple_explanation: string;
  story: string;
  audio_script: string;
}

/**
 * Fetch comprehensive Anna University Exam standard Q&A
 * Strictly 2, 3, 8 and 12-mark questions
 */
export async function fetchGeminiExamQA(prompt: string, language: 'en' | 'ta' = 'en'): Promise<GeminiExamQAResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 40000);

  try {
    const res = await fetch(`${BACKEND_URL}/api/gemini/exam-qa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, language }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch exam Q&A (${res.status})`);
    }

    return await res.json();
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new Error('Exam QA request timed out. Retrying with syllabus generator...');
    }
    throw err;
  }
}

/**
 * Converts syllabus text into conversational Tamil or English explanations and stories
 */
export async function fetchGeminiStory(text: string, language: 'ta' | 'en' = 'ta'): Promise<GeminiStoryResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(`${BACKEND_URL}/api/gemini/story-convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to convert story (${res.status})`);
    }

    return await res.json();
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new Error('Story conversion timed out. Please try again.');
    }
    throw err;
  }
}

/**
 * Client-side speech synthesis using Azure Edge TTS Neural voices via backend
 * Returns Blob URL ready for <audio> element playback and downloading
 */
export async function fetchNeuralSpeechAudio(
  text: string,
  language: 'ta' | 'en' = 'ta',
  mode: 'story' | 'simple' | 'podcast' = 'story'
): Promise<Blob> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(`${BACKEND_URL}/api/gemini/synthesize-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language, mode }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Speech synthesis failed (${res.status})`);
    }

    return await res.blob();
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new Error('Speech synthesis timed out. Playing in native browser speech mode.');
    }
    throw err;
  }
}

export interface GeminiChatResponse {
  success: boolean;
  provider: string;
  answer: string;
}

/**
 * Interactive AI Study Assistant Chat.
 * Supports image/photo attachments for solving handwritten problems & notes.
 */
export async function fetchGeminiChat(
  query: string,
  context?: string,
  language: 'en' | 'ta' = 'en',
  imageBase64?: string,
  mimeType?: string
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(`${BACKEND_URL}/api/gemini/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, context, language, imageBase64, mimeType }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `AI Chat request failed (${res.status})`);
    }

    const data: GeminiChatResponse = await res.json();
    return cleanMathFormatting(data.answer || 'No response generated.');
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new Error('Gemini AI assistant response took too long. Please try again.');
    }
    throw err;
  }
}

/**
 * Ultra-fast server-side Gemini Vision OCR for textbook pages, notes & camera scans.
 * Bypasses heavy mobile WASM downloads and extracts text in ~1-2 seconds.
 */
export async function extractImageWithGemini(file: Blob | File): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const mimeType = file.type || 'image/jpeg';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(`${BACKEND_URL}/api/gemini/extract-image-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mimeType }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Vision extraction failed (${res.status})`);
    }

    const data = await res.json();
    return cleanMathFormatting(data.text || '');
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
