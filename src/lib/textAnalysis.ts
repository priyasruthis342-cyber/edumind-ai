export interface RankedTerm {
  term: string;
  mentions: number;
}

export interface Definition {
  term: string;
  meaning: string;
}

export interface Concept {
  term: string;
  mentions: number;
  tier: 'high' | 'medium' | 'foundation';
  question: string;
  context: string;
}

export interface NotesDocument {
  title: string;
  overview: string[];
  keyPoints: string[];
  definitions: Definition[];
  revisionChecklist: string[];
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'had', 'her', 'was', 'one', 'our', 'out',
  'day', 'get', 'has', 'him', 'his', 'how', 'its', 'let', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who',
  'boy', 'did', 'does', 'she', 'use', 'her', 'than', 'that', 'this', 'with', 'from', 'have', 'they', 'will', 'been',
  'were', 'when', 'what', 'which', 'their', 'there', 'these', 'those', 'then', 'them', 'also', 'into', 'such', 'each',
  'more', 'most', 'some', 'only', 'other', 'about', 'after', 'before', 'over', 'under', 'very', 'just', 'like', 'same',
  'being', 'would', 'could', 'should', 'where', 'while', 'because', 'through', 'between', 'during', 'within', 'without',
  'against', 'again', 'further', 'once', 'here', 'both', 'few', 'own', 'too', 'can', 'its', 'our', 'your', 'his',
  'figure', 'table', 'example', 'exercise', 'activity', 'questions', 'question', 'answer', 'answers', 'chapter',
  'page', 'unit', 'lesson', 'given', 'shown', 'using', 'used', 'use', 'known', 'many', 'much', 'make', 'made',
  'called', 'defined', 'however', 'therefore', 'thus', 'hence', 'since', 'although', 'whether', 'every', 'either',
  'neither', 'another', 'itself', 'themselves', 'yourself', 'ourselves', 'above', 'below', 'between', 'along',
]);

export const DEFINITION_PATTERN = /^((?:the |a |an )?[A-Za-z][\w()'-]*(?: [\w()'-]+){0,4}?)\s+(?:is defined as|refers to|is called|are called|is|are|means)\s+(.{8,})$/i;

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trim()}...`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeText(raw: string): string {
  return raw
    .replace(/\r/g, '')
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0 && !/^(page\s*)?\d{1,4}$/i.test(line))
    .join('\n');
}

export function splitSentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/^[-•*\d.)\s]+(?=[A-Za-z])/, ''))
    .filter((s) => s.length >= 30 && s.length <= 300 && s.split(' ').length >= 5 && /[a-z]/i.test(s));
}

function wordsOf(text: string): string[] {
  return text.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? [];
}

export function frequencyOf(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of wordsOf(text)) {
    if (STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}

export function detectChapterTitle(text: string, fallback: string): string {
  const chapterLine = text.match(
    /^\s*((?:chapter|unit|lesson|அத்தியாயம்|பாடம்|அலகு|अध्याय|पाठ|అధ్యాయం|പാഠം|ಅಧ್ಯಾಯ)\s*(?:no\.?\s*)?[\dIVXLC]*\s*[:.\-–—]?\s*.{0,80})$/im,
  );
  if (chapterLine) return chapterLine[1].trim().slice(0, 100);

  const heading = text
    .split('\n')
    .map((line) => line.trim())
    .slice(0, 8)
    .find((line) => line.length >= 4 && line.length <= 80 && !/[.!?,]$/.test(line) && /[a-z]/i.test(line));
  return heading ?? fallback;
}

export function extractDefinitions(sentences: string[]): Definition[] {
  const seen = new Set<string>();
  const definitions: Definition[] = [];
  for (const sentence of sentences) {
    const match = sentence.match(DEFINITION_PATTERN);
    if (!match) continue;
    const term = match[1].replace(/^(the|a|an)\s+/i, '').trim();
    const key = term.toLowerCase();
    if (term.split(' ').length > 5 || seen.has(key)) continue;
    seen.add(key);
    definitions.push({ term, meaning: match[2].replace(/\.$/, '') });
  }
  return definitions;
}

export function rankTerms(text: string): RankedTerm[] {
  const counts = frequencyOf(text);
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 40)
    .map(([term, mentions]) => ({ term, mentions }));
}

export function sentenceScore(sentence: string, counts: Map<string, number>): number {
  const words = wordsOf(sentence).filter((w) => !STOP_WORDS.has(w));
  if (words.length === 0) return 0;
  const total = words.reduce((sum, w) => sum + (counts.get(w) ?? 0), 0);
  return total / Math.sqrt(words.length);
}

export function extractConcepts(text: string): Concept[] {
  const sentences = splitSentences(text);
  const definitions = extractDefinitions(sentences);
  const definedTerms = new Map(definitions.map((d) => [d.term.toLowerCase(), d]));

  return rankTerms(text)
    .slice(0, 12)
    .map(({ term, mentions }) => {
      const context = sentences.find((s) => new RegExp(`\\b${escapeRegex(term)}\\b`, 'i').test(s)) ?? '';
      const definition = definedTerms.get(term);
      const tier: Concept['tier'] = mentions >= 6 ? 'high' : mentions >= 3 ? 'medium' : 'foundation';
      const question = definition
        ? `What is ${definition.term}?`
        : `Explain ${term} with a suitable example.`;
      return { term: capitalize(term), mentions, tier, question, context: clip(context, 180) };
    });
}

export function buildNotes(text: string, chapterTitle: string): NotesDocument {
  const sentences = splitSentences(text);
  const counts = frequencyOf(text);
  const scored = sentences.map((sentence, index) => ({
    sentence,
    index,
    score: sentenceScore(sentence, counts),
  }));
  const byScore = [...scored].sort((a, b) => b.score - a.score);
  const overviewPicks = byScore.slice(0, 3).sort((a, b) => a.index - b.index);
  const overviewIndexes = new Set(overviewPicks.map((p) => p.index));
  const keyPoints = byScore
    .filter((p) => !overviewIndexes.has(p.index))
    .slice(0, 8)
    .sort((a, b) => a.index - b.index)
    .map((p) => clip(p.sentence, 260));

  const definitions = extractDefinitions(sentences).slice(0, 10);
  const revisionChecklist = rankTerms(text)
    .slice(0, 8)
    .map(({ term, mentions }) => `${capitalize(term)} (appears ${mentions} times in this chapter)`);

  return {
    title: chapterTitle,
    overview: overviewPicks.map((p) => clip(p.sentence, 260)),
    keyPoints,
    definitions,
    revisionChecklist,
  };
}
