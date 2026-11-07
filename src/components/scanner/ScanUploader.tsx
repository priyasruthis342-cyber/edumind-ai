import { useRef, useState, type DragEvent } from 'react';
import { Camera, FileUp, ImagePlus, Loader2, Sparkles, UploadCloud } from 'lucide-react';
import { useApp } from '@/context/useApp';
import { extractTextFromFile } from '@/lib/extractText';
import { ErrorNotice } from '@/components/ui';

export type IntakeKind = 'pdf' | 'image' | 'notes';

export interface ScanSubmission {
  text: string;
  fileName: string;
  kind: IntakeKind;
  chapterHint: string;
}

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function ScanUploader({
  submitLabel,
  courseLabel,
  onSubmit,
}: {
  submitLabel: string;
  courseLabel?: string;
  onSubmit: (submission: ScanSubmission) => Promise<void>;
}) {
  const { t } = useApp();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [kind, setKind] = useState<IntakeKind>('notes');
  const [chapterHint, setChapterHint] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setError('File size exceeds the 25 MB limit. Please upload a smaller file.');
      return;
    }
    setExtracting(true);
    setError(null);
    try {
      const result = await extractTextFromFile(file);
      if (!result.text || !result.text.trim()) {
        throw new Error('No readable text could be found in the document. Please ensure the file contains legible text or scanned pages.');
      }
      // Preserve full A to Z un-truncated text
      const extractedFullText = result.text.trim();
      setText(extractedFullText);
      setFileName(file.name);
      setKind(result.kind === 'text' ? 'notes' : result.kind);
    } catch (err) {
      console.error('File OCR/extraction error:', err);
      setError(err instanceof Error ? err.message : 'Failed to extract text from document.');
    } finally {
      setExtracting(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void readFile(file);
  };

  const handleSubmit = async () => {
    const finalContent = text.trim();
    if (!finalContent) {
      setError('Please upload a document, photo, or paste notes to continue.');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ 
        text: finalContent, 
        fileName: fileName || 'Uploaded Study Material', 
        kind, 
        chapterHint: chapterHint.trim() || courseLabel || 'Syllabus Chapter' 
      });
    } catch (err) {
      console.error('Submission error:', err);
      setError(err instanceof Error ? err.message : 'Could not process submission.');
    } finally {
      setSubmitting(false);
    }
  };

  const busy = extracting || submitting;

  return (
    <div className="space-y-6">
      {courseLabel && (
        <p className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900 ring-1 ring-teal-200">
          <Sparkles className="h-4 w-4 text-teal-700" aria-hidden />
          {t('scanFor')}: {courseLabel}
        </p>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`group flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-8 text-center transition duration-200 sm:p-12 ${
          dragging ? 'border-teal-600 bg-teal-50' : 'border-stone-300 bg-white hover:border-teal-500 hover:bg-teal-50/40'
        }`}
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lift transition group-hover:scale-105">
          {extracting ? <Loader2 className="h-7 w-7 animate-spin" aria-hidden /> : <UploadCloud className="h-7 w-7" aria-hidden />}
        </span>
        <div className="space-y-1">
          <p className="font-semibold text-ink">{t('dropTitle')}</p>
          <p className="text-sm text-stone-600">{t('dropHint')}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => photoInputRef.current?.click()} disabled={busy} className="btn-primary">
            <ImagePlus className="h-4 w-4" aria-hidden />
            {t('choosePhoto')}
          </button>
          <button type="button" onClick={() => documentInputRef.current?.click()} disabled={busy} className="btn-secondary">
            <FileUp className="h-4 w-4" aria-hidden />
            {t('uploadDocument')}
          </button>
          <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={busy} className="btn-secondary">
            <Camera className="h-4 w-4" aria-hidden />
            {t('takePhoto')}
          </button>
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.target.value = '';
          }}
        />
        <input
          ref={documentInputRef}
          type="file"
          accept=".pdf,application/pdf,.txt,.md,text/plain"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.target.value = '';
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.target.value = '';
          }}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="scan-text" className="text-sm font-semibold text-ink">
          {t('pasteLabel')}
        </label>
        <textarea
          id="scan-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={8}
          placeholder={t('pasteLabel')}
          className="input min-h-44 resize-y font-normal leading-relaxed"
        />
        <p className="text-xs text-stone-500">{text.length.toLocaleString()} characters</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="scan-chapter" className="text-sm font-semibold text-ink">
          {t('chapterHint')}
        </label>
        <input
          id="scan-chapter"
          value={chapterHint}
          onChange={(event) => setChapterHint(event.target.value)}
          maxLength={100}
          className="input"
          placeholder="e.g. Chapter 1: Newton's Laws"
        />
      </div>

      {error && <ErrorNotice message={error} />}

      <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-primary w-full sm:w-auto">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
        {submitting ? t('processing') : submitLabel}
      </button>
    </div>
  );
}