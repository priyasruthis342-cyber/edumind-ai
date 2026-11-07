import { useMemo } from 'react';
import { Download, Hash } from 'lucide-react';
import { useApp } from '@/context/useApp';
import { buildPdfBlob, downloadBlob } from '@/lib/pdfExport';
import { buildExamAnswers } from '@/lib/examAnswers';
import { notesToPdfLines } from '@/lib/notesPdf';
import type { NotesDocument } from '@/lib/textAnalysis';
import { SectionHeading } from '@/components/ui';
import { ExamAnswerCard } from '@/components/study/ExamAnswerCard';

function notesFileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chapter';
  return `${slug}-ai-notes.pdf`;
}

const LEGEND = [
  { dot: 'bg-rose-500', key: 'highYield' },
  { dot: 'bg-amber-400', key: 'mediumYield' },
  { dot: 'bg-green-500', key: 'foundationYield' },
] as const;

export function NotesTab({ notes, sourceText }: { notes: NotesDocument; sourceText: string }) {
  const { t } = useApp();
  const examAnswers = useMemo(() => buildExamAnswers(sourceText), [sourceText]);

  const download = () => {
    const lines = notesToPdfLines(notes, examAnswers, {
      aiNotes: t('aiNotes'),
      overview: t('overview'),
      keyPoints: t('keyPoints'),
      definitions: t('definitions'),
      checklist: t('revisionChecklist'),
      examAnswers: t('examAnswers'),
      intro: t('examIntro'),
      conclusion: t('examConclusion'),
      part: (n) => t('examPart', { n }),
    });
    downloadBlob(buildPdfBlob(lines), notesFileName(notes.title));
  };

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading title={t('aiNotes')} subtitle={t('notesSub')} />
        <button type="button" onClick={download} className="btn-primary shrink-0">
          <Download className="h-4 w-4" aria-hidden />
          {t('downloadNotes')}
        </button>
      </div>

      <article className="card space-y-3 p-6 sm:p-8">
        <h3 className="text-lg font-semibold text-ink">{t('overview')}</h3>
        {notes.overview.map((line) => (
          <p key={line} className="text-sm leading-relaxed text-stone-800">
            {line}
          </p>
        ))}
      </article>

      <section className="space-y-5">
        <div className="space-y-3">
          <h3 className="text-xl font-semibold text-ink">{t('examAnswers')}</h3>
          <p className="text-sm leading-relaxed text-stone-700">{t('examAnswersSub')}</p>
          <ul className="flex flex-wrap gap-4 text-xs font-semibold text-stone-700">
            {LEGEND.map((item) => (
              <li key={item.key} className="inline-flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} aria-hidden />
                {t(item.key)}
              </li>
            ))}
          </ul>
        </div>
        {examAnswers.length === 0 ? (
          <p className="card p-6 text-sm text-stone-700">{t('examNoAnswers')}</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {examAnswers.map((answer, index) => (
              <ExamAnswerCard key={answer.id} answer={answer} index={index} />
            ))}
          </div>
        )}
      </section>

      {notes.keyPoints.length > 0 && (
        <article className="card space-y-4 p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-ink">{t('keyPoints')}</h3>
          <ul className="space-y-3">
            {notes.keyPoints.map((line) => (
              <li key={line} className="flex gap-3 text-sm leading-relaxed text-stone-800">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pink-600" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </article>
      )}

      {notes.definitions.length > 0 && (
        <article className="card space-y-4 p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-ink">{t('definitions')}</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            {notes.definitions.map((definition) => (
              <div key={definition.term} className="rounded-xl bg-sky-50 p-4 ring-1 ring-sky-200">
                <dt className="font-semibold text-sky-950">{definition.term}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-stone-800">{definition.meaning}</dd>
              </div>
            ))}
          </dl>
        </article>
      )}

      {notes.revisionChecklist.length > 0 && (
        <article className="card space-y-4 p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-ink">{t('revisionChecklist')}</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {notes.revisionChecklist.map((line) => (
              <li key={line} className="flex items-start gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-stone-800">
                <Hash className="mt-0.5 h-4 w-4 shrink-0 text-pink-700" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </article>
      )}
    </section>
  );
}
