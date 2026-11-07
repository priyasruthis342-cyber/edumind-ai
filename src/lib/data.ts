import type {
  AppNotification,
  LanguageCode,
  NotificationKind,
  Profile,
  QuizAttempt,
  Scan,
  ScanSummary,
  SourceKind,
  StudyPlan,
  UserCourse,
} from '@/types';

const STORAGE_KEYS = {
  PROFILE: 'edumind_profile',
  SCANS: 'edumind_scans',
  PLANS: 'edumind_plans',
  QUIZ_ATTEMPTS: 'edumind_quiz_attempts',
  NOTIFICATIONS: 'edumind_notifications',
  COURSES: 'edumind_courses',
  PAYMENTS: 'edumind_payments',
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
  return data ? JSON.parse(data) : { id: userId, display_name: 'Student', language: 'en' };
}

export async function createProfile(userId: string, displayName: string, language: LanguageCode): Promise<Profile> {
  const profile: Profile = { id: userId, display_name: displayName, language };
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  return profile;
}

export async function updateProfileLanguage(userId: string, language: LanguageCode): Promise<void> {
  const profile = await getProfile(userId);
  if (profile) {
    profile.language = language;
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  }
}

export async function insertScan(input: {
  source_kind: SourceKind;
  file_name: string;
  chapter_title: string;
  raw_text: string;
}): Promise<Scan> {
  const scans: Scan[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCANS) || '[]');
  const newScan: Scan = {
    id: 'scan_' + Math.random().toString(36).substring(2, 9),
    ...input,
    created_at: new Date().toISOString(),
  };
  scans.unshift(newScan);
  localStorage.setItem(STORAGE_KEYS.SCANS, JSON.stringify(scans));
  return newScan;
}

export async function getScan(id: string): Promise<Scan | null> {
  const scans: Scan[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCANS) || '[]');
  return scans.find((s) => s.id === id) || null;
}

export async function listScans(): Promise<ScanSummary[]> {
  const scans: Scan[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCANS) || '[]');
  return scans.map(({ id, source_kind, file_name, chapter_title, created_at }) => ({
    id,
    source_kind,
    file_name,
    chapter_title,
    created_at,
  }));
}

export interface ActiveSyllabus {
  id?: string;
  title: string;
  text: string;
  fileName: string;
}

const ACTIVE_SYLLABUS_KEY = 'edumind_active_syllabus';

export function getActiveSyllabus(): ActiveSyllabus | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SYLLABUS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.text && parsed.text.trim()) {
        return parsed;
      }
    }
  } catch (err) {
    void err;
  }

  // Fallback to the latest scan in localStorage
  try {
    const scans: Scan[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCANS) || '[]');
    if (scans.length > 0) {
      const latest = scans[0];
      return {
        id: latest.id,
        title: latest.chapter_title || latest.file_name,
        text: latest.raw_text,
        fileName: latest.file_name || latest.chapter_title,
      };
    }
  } catch (err) {
    void err;
  }

  return null;
}

export function setActiveSyllabus(syllabus: ActiveSyllabus): void {
  try {
    localStorage.setItem(ACTIVE_SYLLABUS_KEY, JSON.stringify(syllabus));
  } catch (err) {
    void err;
  }
}

export async function insertPlan(input: {
  scan_id: string;
  chapter_title: string;
  total_days: number;
  start_date: string;
}): Promise<StudyPlan> {
  const plans: StudyPlan[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLANS) || '[]');
  const newPlan: StudyPlan = {
    id: 'plan_' + Math.random().toString(36).substring(2, 9),
    ...input,
    days_completed: 0,
    last_completed_on: null,
    created_at: new Date().toISOString(),
  };
  plans.unshift(newPlan);
  localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(plans));
  return newPlan;
}

export async function listPlans(): Promise<StudyPlan[]> {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.PLANS) || '[]');
}

export async function updatePlanProgress(
  planId: string,
  daysCompleted: number,
  lastCompletedOn: string,
): Promise<void> {
  const plans: StudyPlan[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLANS) || '[]');
  const plan = plans.find((p) => p.id === planId);
  if (plan) {
    plan.days_completed = daysCompleted;
    plan.last_completed_on = lastCompletedOn;
    localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(plans));
  }
}

export async function insertQuizAttempt(input: {
  scan_id: string | null;
  chapter_title: string;
  score: number;
  total: number;
}): Promise<QuizAttempt> {
  const attempts: QuizAttempt[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUIZ_ATTEMPTS) || '[]');
  const newAttempt: QuizAttempt = {
    id: 'quiz_' + Math.random().toString(36).substring(2, 9),
    ...input,
    created_at: new Date().toISOString(),
  };
  attempts.unshift(newAttempt);
  localStorage.setItem(STORAGE_KEYS.QUIZ_ATTEMPTS, JSON.stringify(attempts));
  return newAttempt;
}

export async function listQuizAttempts(): Promise<QuizAttempt[]> {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.QUIZ_ATTEMPTS) || '[]');
}

export async function listNotifications(): Promise<AppNotification[]> {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
}

export async function insertNotification(kind: NotificationKind, title: string, body: string): Promise<void> {
  const notifications: AppNotification[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
  notifications.unshift({
    id: 'notif_' + Math.random().toString(36).substring(2, 9),
    kind,
    title,
    body,
    is_read: false,
    created_at: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
}

export async function markNotificationsRead(): Promise<void> {
  const notifications: AppNotification[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
  notifications.forEach((n) => (n.is_read = true));
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
}

export async function listUserCourses(): Promise<UserCourse[]> {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.COURSES) || '[]');
}

export async function insertUserCourse(category: string, courseName: string): Promise<UserCourse> {
  const courses: UserCourse[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.COURSES) || '[]');
  const newCourse: UserCourse = {
    id: 'course_' + Math.random().toString(36).substring(2, 9),
    category,
    course_name: courseName,
  };
  courses.push(newCourse);
  localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
  return newCourse;
}

export async function deleteUserCourse(id: string): Promise<void> {
  let courses: UserCourse[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.COURSES) || '[]');
  courses = courses.filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
}

import { savePaymentPass, isPaymentPassActive } from '@/lib/payment';

export async function hasPaymentOn(day: string): Promise<boolean> {
  if (isPaymentPassActive()) return true;
  const payments: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYMENTS) || '[]');
  return payments.includes(day);
}

export async function recordDailyPayment(reference: string, day: string): Promise<void> {
  savePaymentPass(reference);
  const payments: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PAYMENTS) || '[]');
  if (!payments.includes(day)) {
    payments.push(day);
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  }
}