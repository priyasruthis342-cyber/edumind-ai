import type { ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-stone-600" role="status">
      <Loader2 className="h-4 w-4 animate-spin text-teal-700" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorNotice({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary !py-2 text-xs">
          {retryLabel ?? 'Try again'}
        </button>
      )}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="space-y-2">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">{eyebrow}</p>}
      <h2 className="text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
      {subtitle && <p className="max-w-2xl text-sm leading-relaxed text-stone-700">{subtitle}</p>}
    </div>
  );
}

export function Chip({ children, tone = 'stone' }: { children: ReactNode; tone?: 'stone' | 'teal' | 'amber' | 'rose' | 'sky' | 'emerald' }) {
  const tones: Record<string, string> = {
    stone: 'bg-stone-100 text-stone-800 ring-stone-200',
    teal: 'bg-teal-50 text-teal-900 ring-teal-200',
    amber: 'bg-amber-100 text-amber-950 ring-amber-300',
    rose: 'bg-rose-100 text-rose-950 ring-rose-300',
    sky: 'bg-sky-100 text-sky-950 ring-sky-300',
    emerald: 'bg-emerald-100 text-emerald-950 ring-emerald-300',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tones[tone]}`}>
      {children}
    </span>
  );
}
