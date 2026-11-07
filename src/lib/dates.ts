export function localDateISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dayDifference(fromISO: string, toISO: string): number {
  const from = Date.UTC(...splitISO(fromISO));
  const to = Date.UTC(...splitISO(toISO));
  return Math.round((to - from) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = splitISO(iso);
  return localDateISO(new Date(year, month, day + days));
}

function splitISO(iso: string): [number, number, number] {
  const [year, month, day] = iso.split('-').map(Number);
  return [year, month - 1, day];
}

export function formatDayLabel(iso: string, language: string): string {
  const [year, month, day] = splitISO(iso);
  return new Date(year, month, day).toLocaleDateString(language, { day: 'numeric', month: 'short' });
}
