import { supabase } from '@/lib/supabase';
import type { LanguageCode } from '@/types';

const MAX_SPEECH_CHUNK = 200;

function sentenceChunks(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > MAX_SPEECH_CHUNK && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function findVoice(speechTag: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const normalizedTag = speechTag.replace('_', '-').toLowerCase();
  const base = normalizedTag.split('-')[0];

  // Candidates matching exact language tag or starting with base language
  const candidates = voices.filter((v) => {
    const lang = v.lang.replace('_', '-').toLowerCase();
    return lang === normalizedTag || lang.startsWith(base);
  });

  if (candidates.length === 0) return null;

  // Prioritize modern Neural / Natural / Google high-fidelity voices
  const naturalVoice = candidates.find((v) =>
    /natural|neural|online|google|wavenet/i.test(v.name)
  );
  if (naturalVoice) return naturalVoice;

  // Next prioritize exact language match
  const exact = candidates.find((v) => v.lang.replace('_', '-').toLowerCase() === normalizedTag);
  return exact || candidates[0];
}

export async function loadVoices(): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (window.speechSynthesis.getVoices().length > 0) return;
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, 1500);
    window.speechSynthesis.addEventListener(
      'voiceschanged',
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export type SpeakResult = 'playing' | 'unsupported' | 'no-voice';

export function speakInLanguage(
  text: string,
  speechTag: string,
  onEnd: () => void,
  isStory: boolean = false
): SpeakResult {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return 'unsupported';
  const voice = findVoice(speechTag);
  if (!voice) return 'no-voice';

  const synth = window.speechSynthesis;
  synth.cancel();
  const chunks = sentenceChunks(text);
  let index = 0;

  const speakNext = () => {
    if (index >= chunks.length) {
      onEnd();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    // Calibrated natural pacing & pitch for human tutor / engaging story
    utterance.rate = isStory ? 0.88 : 0.92;
    utterance.pitch = 1.05;
    utterance.onend = () => {
      index += 1;
      speakNext();
    };
    utterance.onerror = () => onEnd();
    synth.speak(utterance);
  };

  speakNext();
  return 'playing';
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export async function translateForAudio(text: string, target: LanguageCode): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ translated?: string; error?: string }>(
    'translate-text',
    { body: { text, target } },
  );
  if (error) throw new Error(error.message);
  if (!data?.translated) throw new Error(data?.error ?? 'Translation returned no text');
  return data.translated;
}
