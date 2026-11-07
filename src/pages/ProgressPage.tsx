import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Crown, Lock, Target, Moon, Sun, Sparkles, BookOpen, Flame, Camera, Info, Bell, BellOff } from 'lucide-react';
import { useApp } from '@/context/useApp';
import { listPlans, listQuizAttempts, listScans, getProfile } from '@/lib/data';
import { localDateISO } from '@/lib/dates';
import {
  computeBadges,
  computeXp,
  levelFromXp,
  type ProgressStats,
} from '@/lib/gamification';
import type { QuizAttempt, StudyPlan, Profile } from '@/types';
import { Chip, ErrorNotice, Spinner } from '@/components/ui';

const RANK_KEYS = ['rankNovice', 'rankApprentice', 'rankScholar', 'rankExpert', 'rankMaster', 'rankLegend'] as const;

interface ProgressData {
  stats: ProgressStats;
  plans: StudyPlan[];
  attempts: QuizAttempt[];
  profile: Profile | null;
}

function badgeKey(id: string): string {
  return `badge${id.charAt(0).toUpperCase()}${id.slice(1)}`;
}

function rankKey(level: number): (typeof RANK_KEYS)[number] {
  return RANK_KEYS[Math.min(level - 1, RANK_KEYS.length - 1)];
}

async function loadProgress(): Promise<ProgressData> {
  const [scans, attempts, plans, profile] = await Promise.all([
    listScans(),
    listQuizAttempts(),
    listPlans(),
    getProfile('student_user_1').catch(() => null),
  ]);
  const stats: ProgressStats = {
    chaptersScanned: scans.length,
    testsTaken: attempts.length,
    perfectTests: attempts.filter((a) => a.total > 0 && a.score === a.total).length,
    correctAnswers: attempts.reduce((sum, a) => sum + a.score, 0),
    studyDaysCompleted: plans.reduce((sum, p) => sum + p.days_completed, 0),
    plansFinished: plans.filter((p) => p.days_completed >= p.total_days).length,
  };
  return { stats, plans, attempts, profile };
}

export function ProgressPage() {
  const { t, language } = useApp();
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Interactive Toggles & Custom Avatar
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await loadProgress());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const xp = useMemo(() => (data ? computeXp(data.stats) : 0), [data]);
  const level = levelFromXp(xp);
  const badges = useMemo(() => (data ? computeBadges(data.stats) : []), [data]);
  const today = localDateISO();

  if (error && !data) return <ErrorNotice message={error} onRetry={() => void load()} retryLabel={t('retry')} />;
  if (!data) return <Spinner label={t('loading')} />;

  const studiedToday = data.plans.some((p) => p.last_completed_on === today);
  const quizzedToday = data.attempts.some((a) => localDateISO(new Date(a.created_at)) === today);
  const missedStudy = notificationsEnabled && !studiedToday;

  const goals = [
    { key: 'goalStudy', hint: missedStudy ? '⚠️ Today study session pending!' : 'progressGoalStudyHint', done: studiedToday },
    { key: 'goalQuiz', hint: 'progressGoalQuizHint', done: quizzedToday },
  ];
  const xpPercent = Math.round(level.fraction * 100);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarUrl(url);
    }
  };

  const studentName = data.profile?.display_name || "Priya Sruthi";

  return (
    <div className={`space-y-10 animate-fade-up pb-16 transition-colors duration-300 ${darkMode ? 'bg-slate-900 text-slate-100 p-6 rounded-3xl' : 'text-ink'}`}>
      
      {/* Top Controls: Dark Mode & Notification Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-4 rounded-2xl border border-stone-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wider">Student Progress Hub</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Notification Toggle Button */}
          <button
            type="button"
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              notificationsEnabled 
                ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300' 
                : 'bg-stone-200 text-stone-600 dark:bg-slate-700 dark:text-slate-400'
            }`}
          >
            {notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {notificationsEnabled ? "Notifications: ON" : "Notifications: OFF"}
          </button>

          {/* Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              darkMode 
                ? 'bg-slate-700 text-amber-300 border border-slate-600' 
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200'
            }`}
          >
            {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-500" />}
            {darkMode ? "Dark Mode: ON" : "Dark Mode: OFF"}
          </button>
        </div>
      </div>

      {/* Hero Banner with Dark Bold Student Name & Custom Profile Photo */}
      <section className="rounded-3xl bg-gradient-to-r from-indigo-700 via-purple-800 to-pink-700 p-6 sm:p-10 text-white shadow-xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="absolute right-4 -bottom-6 opacity-10" aria-hidden>
          <Award className="w-56 h-56" />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 w-fit text-xs font-bold text-amber-300 backdrop-blur-md mb-2">
            <Sparkles className="h-4 w-4" aria-hidden /> Student Progress Journey ({language.toUpperCase()})
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight drop-shadow-md text-amber-200">
            {studentName}&apos;s Academic Progress
          </h1>
          <p className="text-sm text-purple-100 max-w-xl font-medium">
            Every scan, test, and completed study module levels up your academic ranking. Track what you have learned and what lies ahead!
          </p>
        </div>

        {/* Custom Profile Avatar Uploader */}
        <div className="relative flex flex-col items-center z-15">
          <div className="relative w-24 h-24 rounded-full border-4 border-amber-400 overflow-hidden bg-white shadow-2xl flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Student Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-black text-purple-900">{studentName.charAt(0)}</span>
            )}
            <label className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white text-[10px] font-bold">
              <Camera className="h-5 w-5 mb-0.5" />
              Change Photo
              <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarUpload} />
            </label>
          </div>
          <span className="mt-2 text-xs font-black bg-stone-900/80 px-3 py-1 rounded-full text-amber-300 backdrop-blur-sm border border-amber-400/40 shadow-md">
            {studentName}
          </span>
        </div>
      </section>

      {/* Gamified Level & XP Section */}
      <section className="card relative overflow-hidden p-6 sm:p-10 dark:bg-slate-800 dark:border-slate-700">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-200/50 dark:bg-slate-700/30 blur-3xl" aria-hidden />
        <div className="relative grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-orange-300 to-rose-300 p-1.5 shadow-lift">
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white dark:bg-slate-900">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-stone-600 dark:text-slate-400">{t('levelLabel')}</span>
                <span className="text-4xl font-bold text-ink dark:text-white">{level.level}</span>
              </div>
            </div>
            <Chip tone="amber">
              <Crown className="h-3.5 w-3.5" aria-hidden />
              {t(rankKey(level.level))}
            </Chip>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-stone-800 dark:text-slate-200">
                {t('xpLabel')}: {xp}
              </p>
              <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
                {xp === 0 ? t('progressStart') : t('progressNextLevel', { xp: level.nextLevelXp - xp, next: level.level + 1 })}
              </p>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={xpPercent}
              aria-label={t('xpToNext')}
              className="relative h-5 overflow-hidden rounded-full bg-stone-200 dark:bg-slate-700 ring-1 ring-inset ring-stone-300 dark:ring-slate-600"
            >
              <div
                className="animate-xp-fill h-full rounded-full bg-gradient-to-r from-teal-500 via-emerald-400 to-amber-300 shadow-[0_0_18px_rgba(45,212,191,0.6)]"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
            <p className="text-xs text-stone-600 dark:text-slate-400">{xpPercent}%</p>

            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
              {[
                { label: 'chaptersScanned', value: data.stats.chaptersScanned, icon: BookOpen },
                { label: 'testsTaken', value: data.stats.testsTaken, icon: Award },
                { label: 'plansFinished', value: data.stats.plansFinished, icon: CheckCircle2 },
                { label: 'correctAnswer', value: data.stats.correctAnswers, icon: Flame },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-stone-50 dark:bg-slate-700/50 p-4 ring-1 ring-stone-200 dark:ring-slate-600">
                  <p className="text-2xl font-semibold text-ink dark:text-white">{item.value}</p>
                  <p className="text-xs font-medium text-stone-700 dark:text-slate-300">{t(item.label)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="card space-y-5 p-6 dark:bg-slate-800 dark:border-slate-700">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink dark:text-white">
            <Target className="h-5 w-5 text-teal-700 dark:text-teal-400" aria-hidden />
            {t('dailyGoal')}
          </h2>
          <ul className="space-y-3">
            {goals.map((goal) => (
              <li
                key={goal.key}
                className={`flex items-start gap-3 rounded-2xl p-4 ring-1 ${
                  goal.done 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 ring-emerald-300 dark:ring-emerald-800' 
                    : 'bg-rose-50 dark:bg-rose-950/40 ring-rose-300 dark:ring-rose-800'
                }`}
              >
                {goal.done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                ) : (
                  <span className="mt-1 h-4 w-4 shrink-0 rounded-full bg-rose-500 animate-pulse" aria-hidden />
                )}
                <div>
                  <p className="font-semibold text-ink dark:text-white">{t(goal.key)}</p>
                  <p className="text-sm text-stone-700 dark:text-slate-300">{goal.done ? t('goalDone') : goal.hint}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card space-y-5 p-6 dark:bg-slate-800 dark:border-slate-700">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink dark:text-white">
            <Award className="h-5 w-5 text-amber-700 dark:text-amber-400" aria-hidden />
            {t('badges')}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {badges.map((badge) => (
              <li
                key={badge.id}
                className={`flex flex-col items-center gap-2 rounded-2xl p-4 text-center ring-1 transition duration-200 ${
                  badge.unlocked 
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 ring-amber-300 dark:ring-amber-800 hover:-translate-y-0.5' 
                    : 'bg-stone-50 dark:bg-slate-700/40 text-stone-500 dark:text-slate-400 ring-stone-200 dark:ring-slate-600'
                }`}
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${badge.unlocked ? 'bg-amber-200 dark:bg-amber-900' : 'bg-stone-200 dark:bg-slate-600'}`}>
                  {badge.unlocked ? <Award className="h-5 w-5 text-amber-800 dark:text-amber-300" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
                </span>
                <span className="text-xs font-semibold">{t(badgeKey(badge.id))}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* About Section */}
      <section className="card space-y-4 p-6 sm:p-8 bg-gradient-to-br from-teal-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/80 border border-teal-200 dark:border-slate-700">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink dark:text-white">
          <Info className="h-5 w-5 text-teal-700 dark:text-teal-400" />
          About Edumind AI Student Dashboard
        </h2>
        <p className="text-xs sm:text-sm text-stone-700 dark:text-slate-300 leading-relaxed">
          Edumind AI is designed to empower students with high-engagement, AI-powered study tools. From our intelligent Scan-to-Study flow and 12-mark essay question bank to the immersive Theory Audio studio and gamified progress tracking, everything you need for academic excellence is right here. Keep learning consistently and achieve your goals!
        </p>
      </section>
    </div>
  );
}