import { useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { listNotifications, markNotificationsRead } from '@/lib/data';
import { useApp } from '@/context/useApp';
import { ErrorNotice } from '@/components/ui';
import type { AppNotification } from '@/types';

const KIND_TONE: Record<AppNotification['kind'], string> = {
  daily_target: 'bg-emerald-500',
  plan_missed: 'bg-amber-500',
  quiz_result: 'bg-sky-500',
  welcome: 'bg-teal-500',
};

export function NotificationBell() {
  const { t, session } = useApp();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const unread = items.filter((item) => !item.is_read).length;

  const load = () => {
    listNotifications()
      .then((rows) => {
        setItems(rows);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : t('error')));
  };

  useEffect(() => {
    if (session) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  const markAll = async () => {
    try {
      await markNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('error'));
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={t('notifications')}
        aria-expanded={open}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-300 bg-white text-ink shadow-sm transition hover:border-teal-600 hover:text-teal-800"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" aria-label={t('close')} className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-pop overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lift">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <p className="font-semibold text-ink">{t('notifications')}</p>
              <button
                type="button"
                onClick={markAll}
                disabled={unread === 0}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:underline disabled:text-stone-500 disabled:no-underline"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                {t('markAllRead')}
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {error && (
                <div className="p-3">
                  <ErrorNotice message={error} onRetry={load} retryLabel={t('retry')} />
                </div>
              )}
              {!error && items.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-stone-600">{t('noNotifications')}</p>
              )}
              <ul className="divide-y divide-stone-100">
                {items.slice(0, 15).map((item) => (
                  <li key={item.id} className={`flex gap-3 px-4 py-3 ${item.is_read ? '' : 'bg-teal-50/60'}`}>
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${KIND_TONE[item.kind]}`} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <p className="text-sm leading-relaxed text-stone-700">{item.body}</p>
                      <p className="mt-1 text-xs text-stone-500">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
