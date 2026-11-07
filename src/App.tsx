import { useState, type FormEvent } from 'react';
import { BookOpen, Loader2, Sparkles, Trophy, Zap } from 'lucide-react';
import { AppProvider } from '@/context/AppContext';
import { useApp } from '@/context/useApp';
import { useRoute } from '@/lib/router';
import type { Route } from '@/lib/router';
import { AppShell } from '@/components/AppShell';
import { ErrorNotice, Spinner } from '@/components/ui';
import { HomePage } from '@/pages/HomePage';
import { ProgressPage } from '@/pages/ProgressPage';
import { ScanPage } from '@/pages/ScanPage';
import { StudyPage } from '@/pages/StudyPage';
import { TheoryPage } from '@/pages/TheoryPage';
import { LanguageSelect } from '@/components/LanguageSelect';
import { BookIllustration } from '@/components/BookIllustration';
import { PaywallGate } from '@/components/PaywallGate';
import { saveUserToMongoDB } from '@/lib/authApi';

// வெல்கம் / கிரியேட் அக்கவுண்ட் ஸ்கிரீன்
function WelcomeAuthScreen({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const { t } = useApp();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const cleanMobile = mobile.trim().replace(/\D/g, '');
    
    if (cleanMobile.length !== 10) {
      setError('தயவுசெய்து சரியான 10 இலக்க மொபைல் எண்ணை மட்டும் உள்ளிடவும்.');
      setSubmitting(false);
      return;
    }

    const userData = { name: name.trim(), mobile: cleanMobile, display_name: name.trim() };

    if (!userData.name) {
      setError('தயவுசெய்து உங்கள் பெயரை உள்ளிடவும்.');
      setSubmitting(false);
      return;
    }

    try {
      const savedUser = await saveUserToMongoDB(userData.name, userData.mobile);
      const signedInUser = {
        name: savedUser.name,
        mobile: savedUser.mobile,
        display_name: savedUser.name
      };
      localStorage.setItem('edumind_is_logged_in', 'true');
      localStorage.setItem('edumind_custom_user', JSON.stringify(signedInUser));
      localStorage.setItem('edumind_user', JSON.stringify(signedInUser));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'கணக்கைச் சேமிக்க முடியவில்லை.');
      setSubmitting(false);
      return;
    }

    // லாகின் செய்தவுடன் நேராக கோர்ஸ் பக்கத்திற்குச் செல்வது
    window.location.hash = '#/courses';
    
    onLoginSuccess();
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-2">
        <section className="relative flex flex-col justify-between overflow-hidden bg-ink px-6 py-8 text-white sm:px-10 lg:py-12">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-teal-600/30 blur-3xl" aria-hidden />
          <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-amber-500/20 blur-3xl" aria-hidden />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-cyan-600 text-ink">
                <BookOpen className="h-5 w-5" aria-hidden />
              </span>
              <span className="font-display text-xl font-bold">{t('appName')}</span>
            </div>
            <LanguageSelect />
          </div>

          <div className="relative mt-10 space-y-6 lg:mt-0">
            <BookIllustration className="mx-auto w-64 animate-float sm:w-72" />
            <div className="space-y-3 text-center lg:text-left">
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{t('heroTitle')}</h1>
              <p className="text-sm leading-relaxed text-teal-100/90 sm:text-base">{t('authTagline')}</p>
            </div>
            <ul className="grid gap-3 text-sm text-teal-50 sm:grid-cols-3 lg:grid-cols-1">
              <li className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                <Sparkles className="h-4 w-4 text-amber-300" aria-hidden /> AI notes and concept finder
              </li>
              <li className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                <Trophy className="h-4 w-4 text-amber-300" aria-hidden /> Level up with every study day
              </li>
              <li className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                <Zap className="h-4 w-4 text-amber-300" aria-hidden /> Audio lessons in six languages
              </li>
            </ul>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md animate-fade-up space-y-6">
            <div className="rounded-xl bg-teal-800 p-3 text-center text-white font-semibold shadow-sm">
              Create Account
            </div>

            <form onSubmit={handleSubmit} className="card space-y-5 p-6 sm:p-8">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-ink">Name</label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-ink">Mobile Number (10 Digits)</label>
                <input
                  type="tel"
                  placeholder="Enter your 10 digit mobile number"
                  className="input"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  maxLength={10}
                  required
                />
              </div>

              {error && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  {error}
                </p>
              )}

              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Create Account
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

function renderRoute(route: Route) {
  switch (route.name) {
    case 'scan':
      return (
        <PaywallGate>
          <ScanPage course={route.course} />
        </PaywallGate>
      );
    case 'theory':
      return (
        <PaywallGate>
          <TheoryPage />
        </PaywallGate>
      );
    case 'study':
      return (
        <PaywallGate>
          {route.scanId ? <StudyPage id={route.scanId} /> : <HomePage />}
        </PaywallGate>
      );
    case 'progress':
      return (
        <PaywallGate>
          <ProgressPage />
        </PaywallGate>
      );
    case 'home':
      return <HomePage />;
  }
}

function AppBody() {
  const { sessionChecked, accessError, t } = useApp();
  const route = useRoute();

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem('edumind_is_logged_in') === 'true';
  });

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Spinner label={t('loading')} />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <WelcomeAuthScreen onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  return (
    <AppShell route={route}>
      {accessError && (
        <div className="mb-6">
          <ErrorNotice message={accessError} />
        </div>
      )}
      {renderRoute(route)}
    </AppShell>
  );
}

function App() {
  return (
    <AppProvider>
      <AppBody />
    </AppProvider>
  );
}

export default App;