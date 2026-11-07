import {
  capitalize,
  clip,
  escapeRegex,
  extractConcepts,
  frequencyOf,
  sentenceScore,
  splitSentences,
} from '@/lib/textAnalysis';

export type ExamMarks = 6 | 8 | 10 | 16;
export type Importance = 'high' | 'medium' | 'low';

export interface ExamSection {
  points: string[];
}

export interface ExamAnswer {
  id: string;
  topic: string;
  marks: ExamMarks;
  importance: Importance;
  mentions: number;
  question: string;
  intro: string;
  sections: ExamSection[];
  conclusion: string;
}

const POINTS_BY_MARKS: Record<ExamMarks, number> = { 6: 3, 8: 5, 10: 6, 16: 9 };
const POINTS_PER_SECTION = 3;

const QUESTION_TEMPLATES: Record<ExamMarks, (topic: string) => string> = {
  6: (topic) => `Briefly explain ${topic}. (6 marks)`,
  8: (topic) => `Describe ${topic}. (8 marks)`,
  10: (topic) => `Discuss ${topic} with suitable points. (10 marks)`,
  16: (topic) => `Explain ${topic} in detail with examples. (16 marks)`,
};

const MARKS_SCHEDULE: ExamMarks[] = [16, 16, 16, 10, 10, 10, 8, 8, 8, 6, 6, 6];

function importanceFromTier(tier: 'high' | 'medium' | 'foundation'): Importance {
  if (tier === 'high') return 'high';
  if (tier === 'medium') return 'medium';
  return 'low';
}

function sentencesAbout(topic: string, sentences: string[], counts: Map<string, number>): string[] {
  const pattern = new RegExp(`\\b${escapeRegex(topic)}\\b`, 'i');
  return sentences
    .filter((sentence) => pattern.test(sentence))
    .map((sentence) => ({ sentence, score: sentenceScore(sentence, counts) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.sentence);
}

export function buildExamAnswers(text: string): ExamAnswer[] {
  const sentences = splitSentences(text);
  const counts = frequencyOf(text);
  const concepts = extractConcepts(text).slice(0, MARKS_SCHEDULE.length);
  const answers: ExamAnswer[] = [];

  concepts.forEach((concept, index) => {
    const topic = concept.term.toLowerCase();
    const marks = MARKS_SCHEDULE[index];
    const ranked = sentencesAbout(topic, sentences, counts);
    if (ranked.length === 0) return;

    const intro = ranked[0];
    const pool = ranked.slice(1, 1 + POINTS_BY_MARKS[marks]);
    const conclusion = ranked[1 + POINTS_BY_MARKS[marks]] ?? '';
    const points = pool.map((line) => clip(line, 260));

    const sections: ExamSection[] = [];
    for (let start = 0; start < points.length; start += POINTS_PER_SECTION) {
      sections.push({ points: points.slice(start, start + POINTS_PER_SECTION) });
    }

    answers.push({
      id: `exam-${index}`,
      topic: capitalize(topic),
      marks,
      importance: importanceFromTier(concept.tier),
      mentions: concept.mentions,
      question: QUESTION_TEMPLATES[marks](topic),
      intro: clip(intro, 260),
      sections: marks === 6 || marks === 8 ? [{ points }] : sections,
      conclusion: conclusion ? clip(conclusion, 260) : '',
    });
  });

  return answers;
}
