import { Languages } from 'lucide-react';
import { LANGUAGES } from '@/lib/i18n';
import { useApp } from '@/context/useApp';
import type { LanguageCode } from '@/types';

export function LanguageSelect() {
  const { language, setLanguage, t } = useApp();
  return (
    <label className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-ink shadow-sm transition hover:border-teal-600 focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-100">
      <Languages className="h-4 w-4 text-teal-700" aria-hidden />
      <span className="sr-only">{t('languageLabel')}</span>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as LanguageCode)}
        className="cursor-pointer bg-transparent pr-1 text-sm font-semibold focus:outline-none"
      >
        {LANGUAGES.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
