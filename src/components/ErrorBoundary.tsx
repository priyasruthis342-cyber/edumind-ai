import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw, Home, Trash2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  isLooping: boolean;
  showDetails: boolean;
}

const CRASH_COUNTER_KEY = 'edumind_crash_counter';
const MAX_CRASH_ATTEMPTS = 1;

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
    isLooping: false,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log clearly to console.error with full component stack
    console.error('🎓 EDU Mind AI Uncaught UI Error caught by ErrorBoundary:');
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('Component Stack:', errorInfo.componentStack);

    // Track crash frequency in sessionStorage to detect loops
    let crashCount = 1;
    try {
      const stored = sessionStorage.getItem(CRASH_COUNTER_KEY);
      crashCount = stored ? parseInt(stored, 10) + 1 : 1;
      sessionStorage.setItem(CRASH_COUNTER_KEY, String(crashCount));
    } catch {}

    const isLooping = crashCount > MAX_CRASH_ATTEMPTS;

    this.setState({
      error,
      errorInfo,
      isLooping,
      showDetails: isLooping, // Auto-expand technical details if crash loops
    });
  }

  // Clear potentially corrupted persisted state and reload cleanly
  private handleReload = () => {
    try {
      // Clear non-auth temporary keys
      sessionStorage.clear();
      localStorage.removeItem('edumind_payment_pass_v3');
      localStorage.removeItem('edumind_paid_today');
    } catch {}

    // Reset hash if it was a deep or corrupted route
    try {
      if (window.location.hash && window.location.hash !== '#/' && window.location.hash !== '#/courses') {
        window.location.hash = '#/';
      }
    } catch {}

    window.location.reload();
  };

  // Return to clean home dashboard
  private handleGoHome = () => {
    try {
      sessionStorage.removeItem(CRASH_COUNTER_KEY);
      window.location.hash = '#/';
      window.location.reload();
    } catch {
      window.location.href = window.location.origin + window.location.pathname;
    }
  };

  // 1-Click Complete Factory Reset: Clears all local state & starts totally fresh
  private handleResetAllData = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}

    // Navigate to root origin without broken hashes
    window.location.href = window.location.origin + window.location.pathname;
  };

  private handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const text = [
      `EDU Mind AI Error Report:`,
      `Message: ${error?.message || 'Unknown error'}`,
      `Stack:\n${error?.stack || 'No stack'}`,
      `Component Stack:\n${errorInfo?.componentStack || 'No component stack'}`
    ].join('\n\n');

    try {
      void navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {}
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, copied, isLooping, showDetails } = this.state;

      return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4 sm:p-6 text-slate-800">
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-md rounded-3xl border border-purple-200 shadow-2xl p-6 sm:p-8 text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
            {/* Header Icon */}
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/25 text-2xl">
              🎓
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">
                EDU Mind AI
              </h1>
              <span className="text-xs sm:text-sm font-semibold text-purple-900 bg-purple-100/70 py-1 px-3.5 rounded-full inline-block">
                Study Session Protected ✨
              </span>
              <p className="text-xs text-slate-600 leading-relaxed pt-1">
                {isLooping
                  ? 'A persistent display error was detected. You can reset cached data below to restore your session immediately.'
                  : 'A temporary display hiccup occurred on this screen, but your study progress and account data remain completely safe!'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-purple-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reload App &amp; Continue Study</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Home className="h-4 w-4" />
                <span>Return to Home Dashboard</span>
              </button>

              {/* Reset App Data & Start Fresh (Always available, highlighted on loop) */}
              <button
                type="button"
                onClick={this.handleResetAllData}
                className={`w-full py-2.5 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  isLooping
                    ? 'bg-rose-50 border-2 border-rose-300 text-rose-700 hover:bg-rose-100'
                    : 'bg-stone-50 border border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                <span>Reset App Data &amp; Start Fresh</span>
              </button>
            </div>

            {/* Technical Detail Section */}
            {error && (
              <div className="text-left text-[11px] border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between pb-1">
                  <button
                    type="button"
                    onClick={() => this.setState({ showDetails: !showDetails })}
                    className="font-bold text-slate-600 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                  >
                    {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    <span>Technical Details</span>
                  </button>

                  <button
                    type="button"
                    onClick={this.handleCopyError}
                    className="flex items-center gap-1 text-[10px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 px-2 py-0.5 rounded-lg cursor-pointer transition-colors"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? 'Copied!' : 'Copy Error'}</span>
                  </button>
                </div>

                {showDetails && (
                  <div className="mt-2 space-y-2 animate-in fade-in duration-200">
                    <div className="p-2.5 rounded-xl bg-rose-50/80 border border-rose-200 font-mono text-[11px] text-rose-800 break-all">
                      <p className="font-bold">{error.name}: {error.message}</p>
                    </div>

                    {error.stack && (
                      <pre className="p-2.5 rounded-xl bg-slate-900 text-slate-300 font-mono text-[10px] overflow-x-auto max-h-36 whitespace-pre leading-relaxed">
                        {error.stack}
                      </pre>
                    )}

                    {errorInfo?.componentStack && (
                      <pre className="p-2.5 rounded-xl bg-slate-800 text-slate-300 font-mono text-[10px] overflow-x-auto max-h-28 whitespace-pre leading-relaxed">
                        Component Stack:{errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
