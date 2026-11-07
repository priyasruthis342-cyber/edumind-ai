import {
  insertNotification,
  insertPlan,
  insertQuizAttempt,
  listNotifications,
  listPlans,
  listQuizAttempts,
  updatePlanProgress,
} from '@/lib/data';
import { dayDifference, localDateISO } from '@/lib/dates';
import type { AppNotification, NotificationKind, QuizAttempt, StudyPlan } from '@/types';

const DAILY_GOAL_TITLE = 'Daily goal achieved';
const PLAN_MISSED_TITLE = 'Study day missed';

async function pushAlert(kind: NotificationKind, title: string, body: string): Promise<void> {
  await insertNotification(kind, title, body);
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

function isToday(timestamp: string, today: string): boolean {
  return localDateISO(new Date(timestamp)) === today;
}

export async function startStudyPlan(scanId: string, chapterTitle: string, totalDays: number): Promise<StudyPlan> {
  return insertPlan({
    scan_id: scanId,
    chapter_title: chapterTitle,
    total_days: totalDays,
    start_date: localDateISO(),
  });
}

export async function completePlanDay(plan: StudyPlan): Promise<StudyPlan> {
  const today = localDateISO();
  if (plan.last_completed_on === today) return plan;

  const daysCompleted = Math.min(plan.days_completed + 1, plan.total_days);
  await updatePlanProgress(plan.id, daysCompleted, today);
  const updated: StudyPlan = { ...plan, days_completed: daysCompleted, last_completed_on: today };

  if (daysCompleted === plan.total_days) {
    await pushAlert(
      'daily_target',
      'Study plan complete',
      `You finished every day of "${plan.chapter_title}". Great work, Scholar!`,
    );
  } else {
    await pushAlert(
      'daily_target',
      "Today's study target achieved",
      `Day ${daysCompleted} of ${plan.total_days} for "${plan.chapter_title}" is done.`,
    );
  }
  await checkDailyGoal();
  return updated;
}

export async function finishQuiz(input: {
  scanId: string | null;
  chapterTitle: string;
  score: number;
  total: number;
}): Promise<QuizAttempt> {
  const attempt = await insertQuizAttempt({
    scan_id: input.scanId,
    chapter_title: input.chapterTitle,
    score: input.score,
    total: input.total,
  });
  await pushAlert(
    'quiz_result',
    'Practice test scored',
    `You scored ${input.score} out of ${input.total} on "${input.chapterTitle}".`,
  );
  await checkDailyGoal();
  return attempt;
}

export async function checkDailyGoal(): Promise<void> {
  const today = localDateISO();
  const [plans, attempts, notifications] = await Promise.all([
    listPlans(),
    listQuizAttempts(),
    listNotifications(),
  ]);

  const studiedToday = plans.some((plan) => plan.last_completed_on === today);
  const quizzedToday = attempts.some((attempt) => isToday(attempt.created_at, today));
  const alreadyNotified = notifications.some(
    (n) => n.title === DAILY_GOAL_TITLE && isToday(n.created_at, today),
  );

  if (studiedToday && quizzedToday && !alreadyNotified) {
    await pushAlert('daily_target', DAILY_GOAL_TITLE, 'You completed your study day and practice test. Keep the streak going!');
  }
}

function missedNotificationExists(notifications: AppNotification[], plan: StudyPlan, today: string): boolean {
  return notifications.some(
    (n) =>
      n.kind === 'plan_missed' &&
      n.body.includes(plan.chapter_title) &&
      isToday(n.created_at, today),
  );
}

export async function runStudyReminders(): Promise<void> {
  const today = localDateISO();
  const [plans, notifications] = await Promise.all([listPlans(), listNotifications()]);

  for (const plan of plans) {
    if (plan.days_completed >= plan.total_days) continue;
    const daysElapsed = dayDifference(plan.start_date, today);
    const yesterdayMissed = daysElapsed >= 1 && plan.days_completed < daysElapsed;
    if (!yesterdayMissed || missedNotificationExists(notifications, plan, today)) continue;
    await pushAlert(
      'plan_missed',
      PLAN_MISSED_TITLE,
      `You missed a study day for "${plan.chapter_title}". Catch up today to get back on track.`,
    );
  }
}

export function isPlanMissed(plan: StudyPlan, today: string): boolean {
  if (plan.days_completed >= plan.total_days) return false;
  return plan.days_completed < dayDifference(plan.start_date, today);
}
