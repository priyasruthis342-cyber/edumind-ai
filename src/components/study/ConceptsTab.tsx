import { useApp } from '@/context/useApp';
import type { Concept } from '@/lib/textAnalysis';
import { Chip, SectionHeading } from '@/components/ui';

const TIER_TONE = { high: 'rose', medium: 'amber', foundation: 'sky' } as const;
const TIER_LABEL = { high: 'highYield', medium: 'mediumYield', foundation: 'foundationYield' } as const;

export function ConceptsTab({ concepts }: { concepts: Concept[] }) {
  const { t } = useApp();

  if (concepts.length === 0) {
    return <p className="card p-6 text-sm text-stone-700">{t('quizNotEnough')}</p>;
  }

  return (
    <section className="space-y-6">
      <SectionHeading title={t('importantConcepts')} subtitle={t('conceptsSub')} />
      <ul className="grid gap-4 md:grid-cols-2">
        {concepts.map((concept) => (
          <li key={concept.term} className="card flex flex-col gap-3 p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lift">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-ink">{concept.term}</h3>
              <Chip tone={TIER_TONE[concept.tier]}>{t(TIER_LABEL[concept.tier])}</Chip>
            </div>
            <p className="text-sm font-semibold text-teal-800">{concept.question}</p>
            {concept.context && <p className="text-sm leading-relaxed text-stone-700">{concept.context}</p>}
            <p className="mt-auto text-xs font-semibold text-stone-600">
              {concept.mentions} {t('mentions')}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
