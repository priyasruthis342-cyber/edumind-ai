import type { ExamAnswer, Importance } from '@/lib/examAnswers';
import { useApp } from '@/context/useApp';

const IMPORTANCE_STYLES: Record<Importance, { dot: string; border: string; badge: string; labelKey: string }> = {
  high: { dot: 'bg-rose-500', border: 'border-l-rose-500', badge: 'bg-rose-50 text-rose-800 ring-rose-200', labelKey: 'highYield' },
  medium: { dot: 'bg-amber-400', border: 'border-l-amber-400', badge: 'bg-amber-50 text-amber-900 ring-amber-200', labelKey: 'mediumYield' },
  low: { dot: 'bg-green-500', border: 'border-l-green-500', badge: 'bg-green-50 text-green-800 ring-green-200', labelKey: 'foundationYield' },
};

export function ImportanceBadge({ importance }: { importance: Importance }) {
  const { t } = useApp();
  const style = IMPORTANCE_STYLES[importance];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style.badge}`}>
      <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
      {t(style.labelKey)}
    </span>
  );
}

export function ExamAnswerCard({ answer, index }: { answer: ExamAnswer; index: number }) {
  const { t } = useApp();
  const sectionCount = answer.sections.length;

  return (
    <article className={`card space-y-5 border-l-4 p-5 sm:p-6 ${IMPORTANCE_STYLES[answer.importance].border}`}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-600">
            {t('examQuestion', { n: index + 1 })} · {t('marksLabel', { n: answer.marks })}
          </p>
          <h3 className="text-base font-semibold leading-relaxed text-ink">{answer.question}</h3>
        </div>
        <ImportanceBadge importance={answer.importance} />
      </header>

      <div className="space-y-4 text-sm leading-relaxed text-stone-800">
        <div className="space-y-1.5">
          <p className="font-semibold text-ink">{t('examIntro')}</p>
          <p>{answer.intro}</p>
        </div>

        {answer.sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="space-y-1.5">
            {sectionCount > 1 && <p className="font-semibold text-ink">{t('examPart', { n: sectionIndex + 1 })}</p>}
            <ul className="list-disc space-y-1.5 pl-5">
              {section.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        ))}

        {answer.conclusion && (
          <div className="space-y-1.5">
            <p className="font-semibold text-ink">{t('examConclusion')}</p>
            <p>{answer.conclusion}</p>
          </div>
        )}
      </div>
    </article>
  );
}
