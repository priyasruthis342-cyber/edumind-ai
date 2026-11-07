export interface ProgressStats {
  chaptersScanned: number;
  testsTaken: number;
  perfectTests: number;
  correctAnswers: number;
  studyDaysCompleted: number;
  plansFinished: number;
}

export const XP_RULES = {
  scan: 20,
  studyDay: 50,
  planFinished: 100,
  testTaken: 10,
  correctAnswer: 10,
  perfectTest: 25,
} as const;

export function computeXp(stats: ProgressStats): number {
  return (
    stats.chaptersScanned * XP_RULES.scan +
    stats.studyDaysCompleted * XP_RULES.studyDay +
    stats.plansFinished * XP_RULES.planFinished +
    stats.testsTaken * XP_RULES.testTaken +
    stats.correctAnswers * XP_RULES.correctAnswer +
    stats.perfectTests * XP_RULES.perfectTest
  );
}

const LEVEL_STEP = 60;

export interface LevelProgress {
  level: number;
  currentXp: number;
  levelStartXp: number;
  nextLevelXp: number;
  fraction: number;
}

export function levelFromXp(xp: number): LevelProgress {
  const level = Math.floor(Math.sqrt(xp / LEVEL_STEP)) + 1;
  const levelStartXp = LEVEL_STEP * (level - 1) ** 2;
  const nextLevelXp = LEVEL_STEP * level ** 2;
  const fraction = (xp - levelStartXp) / (nextLevelXp - levelStartXp);
  return { level, currentXp: xp, levelStartXp, nextLevelXp, fraction: Math.min(Math.max(fraction, 0), 1) };
}

export interface Badge {
  id: string;
  unlocked: boolean;
}

export function computeBadges(stats: ProgressStats): Badge[] {
  return [
    { id: 'firstScan', unlocked: stats.chaptersScanned >= 1 },
    { id: 'pageHunter', unlocked: stats.chaptersScanned >= 5 },
    { id: 'firstTest', unlocked: stats.testsTaken >= 1 },
    { id: 'sharpMind', unlocked: stats.perfectTests >= 1 },
    { id: 'planPro', unlocked: stats.plansFinished >= 1 },
    { id: 'steadyLearner', unlocked: stats.studyDaysCompleted >= 5 },
  ];
}
