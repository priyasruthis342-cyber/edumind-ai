import {
  DEFINITION_PATTERN,
  capitalize,
  clip,
  escapeRegex,
  extractDefinitions,
  rankTerms,
  shuffle,
  splitSentences,
} from '@/lib/textAnalysis';

export interface McqQuestion {
  id: string;
  kind: 'mcq';
  prompt: string;
  options: string[];
  answerIndex: number;
}

export interface FillQuestion {
  id: string;
  kind: 'fill';
  prompt: string;
  answer: string;
}

export type QuizQuestion = McqQuestion | FillQuestion;

export interface QuizBuildResult {
  questions: QuizQuestion[];
  enoughMaterial: boolean;
}

export const QUIZ_MIN_QUESTIONS = 30;
export const QUIZ_MAX_QUESTIONS = 35;

export function normalizeAnswer(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isFillCorrect(question: FillQuestion, typed: string): boolean {
  const given = normalizeAnswer(typed);
  return given.length > 0 && given === normalizeAnswer(question.answer);
}

export function buildQuiz(text: string): QuizBuildResult {
  const sentences = splitSentences(text);
  const definitions = extractDefinitions(sentences);
  const terms = rankTerms(text).map((t) => t.term);
  const questions: QuizQuestion[] = [];

  definitions.forEach((definition, index) => {
    const distractors = shuffle(definitions.filter((d) => d.term !== definition.term)).slice(0, 3);
    if (distractors.length < 3) return;
    const correct = clip(definition.meaning, 140);
    const options = shuffle([correct, ...distractors.map((d) => clip(d.meaning, 140))]);
    questions.push({
      id: `def-${index}`,
      kind: 'mcq',
      prompt: `What is ${definition.term}?`,
      options,
      answerIndex: options.indexOf(correct),
    });
  });

  const usedPrompts = new Set<string>();
  let blankIndex = 0;
  for (const sentence of shuffle(sentences)) {
    if (sentence.length < 50 || sentence.length > 220) continue;
    if (DEFINITION_PATTERN.test(sentence)) continue;
    const present = terms.filter((term) => new RegExp(`\\b${escapeRegex(term)}\\b`, 'i').test(sentence));
    if (present.length === 0) continue;
    const answer = present[0];
    const blanked = sentence.replace(new RegExp(`\\b${escapeRegex(answer)}\\b`, 'i'), '______');
    if (usedPrompts.has(blanked)) continue;
    usedPrompts.add(blanked);
    const id = `blank-${blankIndex++}`;

    if (blankIndex % 2 === 1) {
      questions.push({ id, kind: 'fill', prompt: `Fill in the blank: ${blanked}`, answer: capitalize(answer) });
      continue;
    }
    const distractors = shuffle(terms.filter((t) => t !== answer && !present.includes(t))).slice(0, 3);
    if (distractors.length < 3) continue;
    const options = shuffle([capitalize(answer), ...distractors.map((d) => capitalize(d))]);
    questions.push({
      id,
      kind: 'mcq',
      prompt: `Choose the missing word: ${blanked}`,
      options,
      answerIndex: options.indexOf(capitalize(answer)),
    });
  }

  const selected = shuffle(questions).slice(0, QUIZ_MAX_QUESTIONS);
  return {
    questions: selected,
    enoughMaterial: selected.length >= QUIZ_MIN_QUESTIONS,
  };
}
