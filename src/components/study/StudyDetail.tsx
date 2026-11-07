import { useMemo } from 'react';
import { Lightbulb, ClipboardCheck, CalendarDays, FileText } from 'lucide-react';
import { useApp } from '@/context/useApp';
import { buildNotes, extractConcepts } from '@/lib/textAnalysis';
import type { Scan } from '@/types';
import { ConceptsTab } from '@/components/study/ConceptsTab';
import { NotesTab } from '@/components/study/NotesTab';
import { PlanTab } from '@/components/study/PlanTab';
import { QuizTab } from '@/components/study/QuizTab';

export type StudyTabKey = 'concepts' | 'notes' | 'plan' | 'quiz';

const TAB_KEYS: StudyTabKey[] = ['concepts', 'notes', 'plan', 'quiz'];

const TAB_ICONS = {
  concepts: Lightbulb,
  notes: FileText,
  plan: CalendarDays,
  quiz: ClipboardCheck,
} as const;

const TAB_LABELS: Record<StudyTabKey, string> = {
  concepts: 'importantConcepts',
  notes: 'aiNotes',
  plan: 'planTitle',
  quiz: 'quizTitle',
};

export function StudyDetail({
  scan,
  tab,
  onTabChange,
}: {
  scan: Scan;
  tab: StudyTabKey;
  onTabChange: (tab: StudyTabKey) => void;
}) {
  const { t } = useApp();
  const concepts = useMemo(() => extractConcepts(scan.raw_text), [scan.raw_text]);
  const notes = useMemo(() => buildNotes(scan.raw_text, scan.chapter_title), [scan.raw_text, scan.chapter_title]);

  return (
    <div className="space-y-8 animate-fade-up">
      <header className="card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-200/50 blur-2xl" aria-hidden />
        <div className="relative space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
            {t('studySource')}: {scan.file_name || scan.source_kind}
          </p>
          <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{scan.chapter_title}</h1>
          <p className="text-sm text-stone-600">{new Date(scan.created_at).toLocaleDateString()}</p>
        </div>
      </header>

      <div role="tablist" aria-label={t('studyTitle')} className="flex gap-2 overflow-x-auto rounded-2xl bg-stone-200/60 p-1.5">
        {TAB_KEYS.map((key) => {
          const Icon = TAB_ICONS[key];
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(key)}
              className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 ${
                active ? 'bg-white text-ink shadow-card' : 'text-stone-700 hover:bg-white/70 hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t(TAB_LABELS[key])}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="animate-fade-up">
        {tab === 'concepts' && <ConceptsTab concepts={concepts} />}
        {tab === 'notes' && <NotesTab notes={notes} sourceText={scan.raw_text} />}
        {tab === 'plan' && <PlanTab scanId={scan.id} chapterTitle={scan.chapter_title} />}
        {tab === 'quiz' && <QuizTab scan={scan} />}
      </div>
    </div>
  );
}
