export type LanguageCode = 'en' | 'ta' | 'te' | 'ml' | 'kn' | 'hi';

export type SourceKind = 'textbook' | 'notes' | 'pdf' | 'image' | 'theory';

export interface Profile {
  id: string;
  display_name: string;
  language: LanguageCode;
}

export interface Scan {
  id: string;
  source_kind: SourceKind;
  file_name: string;
  chapter_title: string;
  raw_text: string;
  created_at: string;
}

export type ScanSummary = Omit<Scan, 'raw_text'>;

export interface StudyPlan {
  id: string;
  scan_id: string | null;
  chapter_title: string;
  total_days: number;
  days_completed: number;
  start_date: string;
  last_completed_on: string | null;
  created_at: string;
}

export interface QuizAttempt {
  id: string;
  scan_id: string | null;
  chapter_title: string;
  score: number;
  total: number;
  created_at: string;
}

export type NotificationKind = 'daily_target' | 'plan_missed' | 'quiz_result' | 'welcome';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface UserCourse {
  id: string;
  category: string;
  course_name: string;
}

export interface CatalogGroup {
  label: string;
  items: string[];
}

export interface CatalogCategory {
  id: string;
  accent: 'pink' | 'sky' | 'green' | 'ink';
  groups: CatalogGroup[];
}
