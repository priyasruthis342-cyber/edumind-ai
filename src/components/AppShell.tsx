import { type ReactNode, useState, useEffect } from 'react';
import { LogOut, Bell, BookOpen, BookMarked, BrainCircuit, BarChart3, ScanText } from 'lucide-react';
import { useApp } from '@/context/useApp';
import { LanguageSelect } from '@/components/LanguageSelect';
import type { Route } from '@/lib/router';

interface AppShellProps {
  children: ReactNode;
  route: Route;
}

// பல்வேறு மொழிகளுக்கான மோட்டிவேஷனல் வாக்கியங்கள்
const motivationalQuotes: Record<string, string> = {
  ta: "வெற்றி என்பது தொடர் முயற்சியால் மட்டுமே சாத்தியம்! தொடர்ந்து கற்போம்.", // Tamil
  hi: "سफलता निरंतर प्रयास से मिलती है! सीखते रहें, आगे बढ़ते रहें।", // Hindi
  te: "విజయము నిరంతర కృషి ద్వారానే సాధ్యం! నేర్చుకుంటూ ఉండండి.", // Telugu
  ml: "തുടർച്ചയായ പരിശ്രമത്തിലൂടെ മാത്രമേ വിജയം നേടാനാകൂ!", // Malayalam
  kn: "ನಿರಂತರ ಪ್ರಯತ್ನದಿಂದ ಮಾತ್ರ ಯಶಸ್ಸು ಸಾಧ್ಯ! ಕಲಿಕೆಯನ್ನು ಮುಂದುವರಿಸಿ.", // Kannada
  en: "Success is achieved through consistent effort! Keep learning." // English
};

export function AppShell({ children, route }: AppShellProps) {
  const { t, language } = useApp();
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    // லோக்கல் ஸ்டோரேஜில் இருந்து பயனரின் பெயரைக் கண்டறிதல்
    const localUser = localStorage.getItem('edumind_custom_user');
    if (localUser) {
      try {
        const parsed = JSON.parse(localUser);
        if (parsed && parsed.name) {
          setUserName(parsed.name);
        }
      } catch {
        // Fallback if parsing fails
      }
    }
  }, []);

  const handleCustomLogout = () => {
    // அனைத்து டேட்டாக்களையும் முழுமையாக நீக்கிவிட்டு வெல்கம் பக்கத்திற்குத் திருப்புவது
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = '#/';
    window.location.reload();
  };

  // தற்போதைய மொழிக்கு ஏற்ற மோட்டிவேஷனல் வாக்கியத்தைத் தேர்ந்தெடுத்தல் (Default to English)
  const currentQuote = motivationalQuotes[language] || motivationalQuotes['en'];

  return (
    <div className="min-h-screen bg-transparent text-ink">
      <header className="sticky top-0 z-30 border-b border-stone-200/90 bg-white/90 backdrop-blur-md shadow-xs transition-colors">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-indigo-600 to-purple-600 text-white font-black shadow-md shadow-indigo-600/30 text-base ring-2 ring-white/80">
              📚
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <p className="font-display font-extrabold leading-none text-ink text-base sm:text-lg tracking-tight truncate">{t('appName')}</p>
                {userName && (
                  <span className="hidden xs:inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-teal-100 to-indigo-100 border border-teal-200/80 px-2.5 py-0.5 text-[11px] font-bold text-teal-900 truncate max-w-[120px] sm:max-w-none shadow-2xs">
                    ✨ {userName}
                  </span>
                )}
              </div>
              {/* மொழிக்கு ஏற்ப மாறக்கூடிய மோட்டிவேஷனல் வரி */}
              <p className="hidden sm:block mt-1 text-xs font-semibold text-indigo-900/70 italic truncate max-w-md">
                "{currentQuote}"
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <LanguageSelect />

            <button
              type="button"
              className="rounded-xl p-1.5 sm:p-2 text-stone-600 hover:bg-stone-100 transition-colors"
              title="Notifications"
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            <button
              onClick={handleCustomLogout}
              className="flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* மெனு ஆப்ஷன்கள் பாக்ஸ் வரிசை - மொபைல் போன்களில் மென்மையான ஸ்லைடிங் ஆதரவு */}
        <div className="border-t border-stone-200/70 bg-white/70 px-2.5 py-2 sm:px-6 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto whitespace-nowrap pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
            <a
              href="#/"
              className={`flex items-center gap-1.5 rounded-2xl px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold transition-all shrink-0 ${
                route.name === 'home'
                  ? 'bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-md shadow-indigo-600/25 scale-102'
                  : 'bg-white/90 text-stone-700 border border-stone-200/90 hover:bg-white hover:border-teal-400 shadow-xs'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Courses
            </a>
            <a
              href="#/scan"
              className={`flex items-center gap-1.5 rounded-2xl px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold transition-all shrink-0 ${
                route.name === 'scan'
                  ? 'bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-md shadow-indigo-600/25 scale-102'
                  : 'bg-white/90 text-stone-700 border border-stone-200/90 hover:bg-white hover:border-teal-400 shadow-xs'
              }`}
            >
              <ScanText className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Scanner
            </a>
            <a
              href="#/study"
              className={`flex items-center gap-1.5 rounded-2xl px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold transition-all shrink-0 ${
                route.name === 'study'
                  ? 'bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-md shadow-indigo-600/25 scale-102'
                  : 'bg-white/90 text-stone-700 border border-stone-200/90 hover:bg-white hover:border-teal-400 shadow-xs'
              }`}
            >
              <BookMarked className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> My Study
            </a>
            <a
              href="#/theory"
              className={`flex items-center gap-1.5 rounded-2xl px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold transition-all shrink-0 ${
                route.name === 'theory'
                  ? 'bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-md shadow-indigo-600/25 scale-102'
                  : 'bg-white/90 text-stone-700 border border-stone-200/90 hover:bg-white hover:border-teal-400 shadow-xs'
              }`}
            >
              <BrainCircuit className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Theory Audio
            </a>
            <a
              href="#/progress"
              className={`flex items-center gap-1.5 rounded-2xl px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold transition-all shrink-0 ${
                route.name === 'progress'
                  ? 'bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-md shadow-indigo-600/25 scale-102'
                  : 'bg-white/90 text-stone-700 border border-stone-200/90 hover:bg-white hover:border-teal-400 shadow-xs'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> My Progress
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">{children}</main>
    </div>
  );
}