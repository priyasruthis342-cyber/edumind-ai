import { ScanLine, ShieldCheck } from 'lucide-react';
import { useApp } from '@/context/useApp';
import { insertScan, setActiveSyllabus } from '@/lib/data';
import { detectChapterTitle } from '@/lib/textAnalysis';
import { navigate, studyPath } from '@/lib/router';
import { ScanUploader, type ScanSubmission } from '@/components/scanner/ScanUploader';
import { SectionHeading } from '@/components/ui';

const MIN_SCAN_CHARACTERS = 200;
const MAX_SCAN_CHARACTERS = 200_000;

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

export function ScanPage({ course }: { course: string }) {
  const { t } = useApp();

  const handleSubmit = async ({ text, fileName, kind, chapterHint }: ScanSubmission) => {
    if (text.length < MIN_SCAN_CHARACTERS) throw new Error(t('scanTooShort'));
    if (text.length > MAX_SCAN_CHARACTERS) throw new Error(t('scanFailed'));

    const fallbackTitle = course || baseName(fileName) || 'Scanned notes';
    const chapterTitle = chapterHint || detectChapterTitle(text, fallbackTitle);
    const scan = await insertScan({
      source_kind: kind,
      file_name: fileName,
      chapter_title: chapterTitle,
      raw_text: text,
    });
    setActiveSyllabus({
      id: scan.id,
      title: chapterTitle,
      text: text,
      fileName: fileName || chapterTitle,
    });
    navigate(studyPath(scan.id));
  };

  return (
    <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6 sm:space-y-8 animate-fade-up">
        <SectionHeading eyebrow="AI Syllabus Extraction" title={t('scannerTitle')} subtitle={t('scannerSub')} />
        <div className="card p-4 sm:p-8">
          <ScanUploader
            submitLabel={t('processScan')}
            courseLabel={course || undefined}
            onSubmit={handleSubmit}
          />
        </div>
      </div>

      <aside className="space-y-4 lg:pt-16">
        <div className="card space-y-4 p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-900">
            <ScanLine className="h-5 w-5" aria-hidden />
          </span>
          <p className="font-semibold text-ink">What happens next</p>
          <ol className="space-y-3 text-sm leading-relaxed text-stone-700">
            <li>1. We read the page and detect the chapter title.</li>
            <li>2. You get concepts, AI notes, a study plan and a practice test.</li>
            <li>3. Everything is built only from your scanned text.</li>
          </ol>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
          Your scans are private to your account.
        </div>
      </aside>
    </div>
  );
}