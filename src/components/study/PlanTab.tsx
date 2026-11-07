import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck2, CheckCircle2, Sparkles, TriangleAlert } from 'lucide-react';
import { useApp } from '@/context/useApp';
import { listPlans } from '@/lib/data';
import { addDays, formatDayLabel, localDateISO } from '@/lib/dates';
import { completePlanDay, isPlanMissed, startStudyPlan } from '@/lib/studyEvents';
import type { StudyPlan } from '@/types';
import { Chip, ErrorNotice, SectionHeading, Spinner } from '@/components/ui';

const PLAN_OPTIONS = [
  { days: 2, labelKey: 'planTwoDay' },
  { days: 3, labelKey: 'planThreeDay' },
] as const;

export function PlanTab({ scanId, chapterTitle }: { scanId: string; chapterTitle: string }) {
  const { t, language } = useApp();
  const [plans, setPlans] = useState<StudyPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = localDateISO();

  const load = useCallback(async () => {
    setError(null);
    try {
      const all = await listPlans();
      setPlans(all.filter((plan) => plan.scan_id === scanId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
    }
  }, [scanId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const activePlan = plans?.[0] ?? null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
    } finally {
      setBusy(false);
    }
  };

  if (error && !plans) return <ErrorNotice message={error} onRetry={() => void load()} retryLabel={t('retry')} />;
  if (!plans) return <Spinner label={t('loading')} />;

  const startPlan = (days: number) =>
    run(async () => {
      await startStudyPlan(scanId, chapterTitle, days);
    });

  const markDone = (plan: StudyPlan) =>
    run(async () => {
      await completePlanDay(plan);
    });

  if (!activePlan || (activePlan.days_completed >= activePlan.total_days && !busy)) {
    const complete = activePlan !== null;
    return (
      <section className="space-y-6">
        {complete && (
          <div className="card flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-ink">{t('planCompleteTitle')}</h3>
              <p className="text-sm text-stone-700">{t('planCompleteBody')}</p>
            </div>
          </div>
        )}
        <SectionHeading title={t('planChooseTitle')} subtitle={t('planChooseSub')} />
        {error && <ErrorNotice message={error} />}
        <div className="grid gap-4 sm:grid-cols-2">
          {PLAN_OPTIONS.map((option) => (
            <button
              key={option.days}
              type="button"
              disabled={busy}
              onClick={() => void startPlan(option.days)}
              className="card group flex flex-col items-start gap-3 p-6 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-lift disabled:opacity-60"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-800 transition group-hover:scale-110">
                <CalendarCheck2 className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-lg font-semibold text-ink">{t(option.labelKey)}</span>
              <span className="text-sm text-stone-700">{t('planDayCount', { total: option.days })}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  const isDoneToday = activePlan.last_completed_on === today;
  const missed = isPlanMissed(activePlan, today);
  const nextDay = Math.min(activePlan.days_completed + 1, activePlan.total_days);
  const percent = Math.round((activePlan.days_completed / activePlan.total_days) * 100);

  return (
    <section className="space-y-6">
      <SectionHeading
        title={t('planTitle')}
        subtitle={t('planStartedOn', { date: formatDayLabel(activePlan.start_date, language) })}
      />

      {missed && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
          <div>
            <p className="font-semibold">{t('planMissedTitle')}</p>
            <p className="text-sm">{t('planMissedBody')}</p>
          </div>
        </div>
      )}

      <div className="card space-y-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Chip tone="teal">{t('planProgress', { done: activePlan.days_completed, total: activePlan.total_days })}</Chip>
          <span className="text-sm font-semibold text-stone-700">{percent}%</span>
        </div>

        <ol className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: activePlan.total_days }, (_, index) => {
            const dayNumber = index + 1;
            const done = dayNumber <= activePlan.days_completed;
            const current = dayNumber === nextDay && !done;
            const date = formatDayLabel(addDays(activePlan.start_date, index), language);
            return (
              <li
                key={dayNumber}
                className={`flex items-center gap-3 rounded-2xl p-4 ring-1 transition duration-300 ${
                  done
                    ? 'bg-emerald-50 text-emerald-950 ring-emerald-300'
                    : current
                      ? 'bg-teal-50 text-teal-950 ring-teal-400 shadow-card'
                      : 'bg-stone-50 text-stone-600 ring-stone-200'
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    done ? 'bg-emerald-600 text-white' : current ? 'bg-teal-600 text-white' : 'bg-white text-stone-600'
                  }`}
                >
                  {done ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : dayNumber}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t('planDayOf', { n: dayNumber, total: activePlan.total_days })}</p>
                  <p className="text-xs">{date}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {isDoneToday ? (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
            <Sparkles className="h-4 w-4" aria-hidden />
            {t('planDoneToday')}
          </p>
        ) : (
          <button type="button" disabled={busy} onClick={() => void markDone(activePlan)} className="btn-primary w-full sm:w-auto">
            {busy ? <Spinner /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
            {t('planTodayDone')}
          </button>
        )}
        {error && <ErrorNotice message={error} />}
      </div>
    </section>
  );
}
