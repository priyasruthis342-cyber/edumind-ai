import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw, AlertTriangle, Home, Sparkles } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('EDU Mind AI Uncaught UI Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    try {
      // Clear any corrupted local state while preserving user login
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  private handleGoHome = () => {
    try {
      window.location.hash = '#/';
      window.location.reload();
    } catch {
      window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4 sm:p-6 text-slate-800">
          <div className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl border border-purple-200 shadow-2xl p-6 sm:p-8 text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
            {/* Header Icon */}
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/25 text-2xl">
              🎓
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">
                EDU Mind AI
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-purple-900 bg-purple-100/70 py-1 px-3 rounded-full inline-block">
                Study Session Protected ✨
              </p>
              <p className="text-xs text-slate-600 leading-relaxed pt-1">
                A temporary display hiccup occurred on this screen, but your study progress and account data remain completely safe!
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
            </div>

            {/* Technical Detail Preview (Collapsible) */}
            {this.state.error && (
              <details className="text-left text-[11px] text-slate-400 border-t border-slate-100 pt-3">
                <summary className="cursor-pointer hover:text-slate-600 transition-colors">
                  Technical Details
                </summary>
                <p className="mt-1 p-2 rounded-xl bg-slate-50 font-mono text-[10px] text-rose-700 overflow-x-auto break-all">
                  {this.state.error.message || 'Unknown render error'}
                </p>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
