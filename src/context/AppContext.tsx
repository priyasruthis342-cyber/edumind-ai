import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  createProfile,
  getProfile,
  hasPaymentOn,
  insertUserCourse,
  listUserCourses,
  recordDailyPayment,
  updateProfileLanguage,
} from '@/lib/data';
import { isPaymentPassActive, savePaymentPass } from '@/lib/payment';
import { localDateISO } from '@/lib/dates';
import { translate } from '@/lib/i18n';
import { runStudyReminders } from '@/lib/studyEvents';
import type { LanguageCode, Profile, UserCourse } from '@/types';

const LANGUAGE_STORAGE_KEY = 'edumind-language';

function readStoredLanguage(): LanguageCode {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
  return stored === 'ta' || stored === 'te' || stored === 'ml' || stored === 'kn' || stored === 'hi' ? stored : 'en';
}

export interface AppContextValue {
  session: Session | null;
  sessionChecked: boolean;
  profile: Profile | null;
  language: LanguageCode;
  today: string;
  paidToday: boolean;
  courses: UserCourse[];
  accessError: string | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLanguage: (language: LanguageCode) => void;
  addCourse: (category: string, courseName: string) => Promise<void>;
  payForToday: (reference: string) => Promise<void>;
  signOut: () => Promise<void>;
  reloadAccess: () => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [language, setLanguageState] = useState<LanguageCode>(readStoredLanguage);
  // Initialize with 24-hour persistent pass from localStorage
  const [paidToday, setPaidToday] = useState<boolean>(() => isPaymentPassActive());
  const [courses, setCourses] = useState<UserCourse[]>([]);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const today = localDateISO();

  // Listen to visibility & focus events (e.g. user returns from WhatsApp or another app)
  useEffect(() => {
    const checkPassPersistence = () => {
      if (isPaymentPassActive()) {
        setPaidToday(true);
      }
    };
    checkPassPersistence();

    window.addEventListener('visibilitychange', checkPassPersistence);
    window.addEventListener('focus', checkPassPersistence);
    return () => {
      window.removeEventListener('visibilitychange', checkPassPersistence);
      window.removeEventListener('focus', checkPassPersistence);
    };
  }, []);

  useEffect(() => {
    let active = true;
    try {
      supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        setSession(data?.session ?? null);
        setSessionChecked(true);
      }).catch((err) => {
        console.warn('Supabase session initialization notice:', err?.message || err);
        if (active) setSessionChecked(true);
      });

      const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setSessionChecked(true);
      });

      return () => {
        active = false;
        listener?.subscription?.unsubscribe();
      };
    } catch (e) {
      console.warn('Supabase auth listener notice:', e);
      setSessionChecked(true);
    }
  }, []);

  const userId = session?.user.id ?? null;
  const seedName = session?.user.user_metadata?.display_name ?? session?.user.email ?? 'Scholar';

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      // Retain 24-hour daily pass validity for local & phone-authenticated users
      setPaidToday(isPaymentPassActive());
      setCourses([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setAccessError(null);
        let row = await getProfile(userId);
        if (!row) {
          row = await createProfile(userId, String(seedName), readStoredLanguage());
        }
        if (cancelled) return;
        setProfile(row);
        setLanguageState(row.language);
        localStorage.setItem(LANGUAGE_STORAGE_KEY, row.language);

        const [paid, savedCourses] = await Promise.all([hasPaymentOn(localDateISO()), listUserCourses()]);
        if (cancelled) return;
        setPaidToday(paid || isPaymentPassActive());
        setCourses(savedCourses);
        await runStudyReminders();
      } catch (error) {
        if (!cancelled) setAccessError(error instanceof Error ? error.message : 'Unknown error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, seedName, reloadToken]);

  const setLanguage = useCallback(
    (next: LanguageCode) => {
      setLanguageState(next);
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      if (userId) {
        setProfile((current) => (current ? { ...current, language: next } : current));
        updateProfileLanguage(userId, next).catch((error: unknown) => {
          setAccessError(error instanceof Error ? error.message : 'Could not save language');
        });
      }
    },
    [userId],
  );

  const addCourse = useCallback(async (category: string, courseName: string) => {
    const saved = await insertUserCourse(category, courseName);
    setCourses((current) => (current.some((course) => course.id === saved.id) ? current : [...current, saved]));
  }, []);

  const payForToday = useCallback(async (reference: string) => {
    savePaymentPass(reference);
    await recordDailyPayment(reference, localDateISO());
    setPaidToday(true);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Supabase signOut notice:', err);
    }
    setSession(null);
    setProfile(null);
  }, []);

  const reloadAccess = useCallback(async () => {
    setReloadToken((value) => value + 1);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      session,
      sessionChecked,
      profile,
      language,
      today,
      paidToday,
      courses,
      accessError,
      t: (key: string, vars?: Record<string, string | number>) => translate(language, key, vars),
      setLanguage,
      addCourse,
      payForToday,
      signOut,
      reloadAccess,
    }),
    [session, sessionChecked, profile, language, today, paidToday, courses, accessError, setLanguage, addCourse, payForToday, signOut, reloadAccess],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
