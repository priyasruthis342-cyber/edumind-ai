export type AudioMode = 'story' | 'rhyme';

const RHYME_PAIRS: [string, string][] = [
  ['right', 'sight'],
  ['bright', 'light'],
  ['along', 'strong'],
  ['true', 'through'],
  ['mind', 'find'],
  ['play', 'way'],
];

const TRANSITIONS = ['First,', 'Then,', 'Next,', 'Meanwhile,', 'Soon,', 'Later,', 'Finally,'];

function shorten(sentence: string, maxWords: number): string {
  const words = sentence.replace(/[.!?]+$/, '').split(/\s+/);
  return words.slice(0, maxWords).join(' ');
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function buildStoryScript(chapterTitle: string, keyPoints: string[]): string {
  const points = keyPoints.slice(0, 10);
  const story = points.map((point, index) => {
    const transition = TRANSITIONS[index % TRANSITIONS.length];
    return `${transition} ${lowerFirst(point.replace(/[.!?]+$/, ''))}.`;
  });
  return [
    `Let us begin our story. Today's adventure is called ${chapterTitle}.`,
    ...story,
    `And that is the story of ${chapterTitle}. Picture these ideas in your mind, and you will remember them for a long time.`,
  ].join(' ');
}

export function buildRhymeScript(chapterTitle: string, keyPoints: string[], conceptTerms: string[]): string {
  const lines: string[] = [`Let us sing and learn ${chapterTitle}. Clap along with me!`];
  const points = keyPoints.slice(0, 8);

  for (let i = 0; i < points.length; i += 2) {
    const [endingA, endingB] = RHYME_PAIRS[(i / 2) % RHYME_PAIRS.length];
    lines.push(`${shorten(points[i], 12)}, learn it ${endingA}.`);
    const second = points[i + 1];
    if (second) {
      lines.push(`${shorten(second, 12)}, keep it in ${endingB}.`);
    }
  }

  const terms = conceptTerms.slice(0, 4);
  if (terms.length > 0) {
    lines.push(`Say it loud, say it clear: ${terms.join('! ')}!`);
    lines.push(`Say it again, ${terms.join(', ')}, and you will know it, my dear.`);
  }
  lines.push(`Read it, sing it, clap it, know it. ${chapterTitle} is yours now!`);
  return lines.join(' ');
}
