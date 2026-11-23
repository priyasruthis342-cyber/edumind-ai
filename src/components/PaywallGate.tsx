import { useState, type ReactNode } from 'react';
import {
  CheckCircle2, Crown, Loader2, Lock, ScanLine, Music,
  ClipboardCheck, X, CreditCard, ShieldCheck, Sparkles, Zap
} from 'lucide-react';
import { useApp } from '@/context/useApp';
import {
  PASS_AMOUNT_RUPEES,
  startRazorpayCheckout,
  isPaymentPassActive,
} from '@/lib/payment';
import { BookIllustration } from '@/components/BookIllustration';
import { ErrorNotice } from '@/components/ui';

export function PaywallGate({ children }: { children: ReactNode }) {
  const { paidToday } = useApp();
  if (paidToday || isPaymentPassActive()) return <>{children}</>;
  return <PaywallCard />;
}

export function PaywallCard() {
  const [open, setOpen] = useState(false);
  const { t } = useApp();

  return (
    <>
      <section className="card relative overflow-hidden p-6 sm:p-10">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-300/30 blur-3xl" aria-hidden />
        <div className="relative grid items-center gap-8 md:grid-cols-2">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-950 ring-1 ring-amber-300">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              ₹1 / day • Valid until 12:00 AM Midnight
            </span>
            <h2 className="text-2xl font-semibold sm:text-3xl">{t('payTitle')}</h2>
            <p className="text-sm leading-relaxed text-stone-700 sm:text-base">{t('payBody')}</p>
            <ul className="space-y-2.5 text-sm text-stone-800">
              <li className="flex items-center gap-2.5">
                <ScanLine className="h-4 w-4 text-teal-700" aria-hidden /> Smart handwritten notes &amp; PDF scanner
              </li>
              <li className="flex items-center gap-2.5">
                <Music className="h-4 w-4 text-teal-700" aria-hidden /> Story and rhythm audio lessons in your language
              </li>
              <li className="flex items-center gap-2.5">
                <ClipboardCheck className="h-4 w-4 text-teal-700" aria-hidden /> 2, 3, 8 &amp; 12-mark university question bank
              </li>
            </ul>
            <button type="button" onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2">
              <Crown className="h-4 w-4" aria-hidden />
              {t('payButton')} (₹1 Daily Pass)
            </button>
          </div>
          <BookIllustration className="mx-auto hidden w-64 animate-float md:block" />
        </div>
      </section>

      {open && <PaymentDialog onClose={() => setOpen(false)} onPaid={() => setOpen(false)} />}
    </>
  );
}

export function PaymentDialog({ onClose, onPaid }: { onClose: () => void; onPaid: () => void }) {
  const { t, payForToday } = useApp();
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preload checkout script immediately when dialog opens for instant modal launch
  useEffect(() => {
    void loadRazorpayScript();
  }, []);

  // Live Razorpay Payment Checkout Handler
  const handleRazorpayPayment = async () => {
    setProcessing(true);
    setError(null);

    // 8-second safety guard to ensure spinner never gets stuck indefinitely
    const safetyTimer = setTimeout(() => {
      setProcessing(false);
      setError('Payment gateway connection timed out. Please check your connection and tap retry.');
    }, 8000);

    try {
      await startRazorpayCheckout({
        amountRupees: PASS_AMOUNT_RUPEES,
        onSuccess: async (paymentId: string) => {
          clearTimeout(safetyTimer);
          await payForToday(paymentId);
          setDone(true);
          setProcessing(false);
          setTimeout(() => {
            onPaid();
          }, 1000);
        },
        onError: (err: Error) => {
          clearTimeout(safetyTimer);
          setError(err.message || 'Payment was cancelled or failed.');
          setProcessing(false);
        },
        onDismiss: () => {
          clearTimeout(safetyTimer);
          setProcessing(false);
        },
      });
    } catch (err: unknown) {
      clearTimeout(safetyTimer);
      setError(err instanceof Error ? err.message : 'Could not initialize payment gateway.');
      setProcessing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-7 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          disabled={processing}
          aria-label={t('cancel')}
          className="absolute right-4 top-4 rounded-xl p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {done ? (
          <div className="space-y-3 py-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <h3 className="font-display text-xl font-bold text-ink">Payment Successful!</h3>
            <p className="text-xs text-stone-600">
              Your ₹1 Daily Pass is active. Access is unlocked until <strong>12:00 AM Midnight</strong> tonight.
            </p>
            <button
              type="button"
              onClick={onPaid}
              className="btn-primary w-full mt-2"
            >
              Start Studying Now
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5 pr-8">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 border border-teal-200 px-3 py-0.5 text-[11px] font-bold text-teal-900">
                <Sparkles className="h-3 w-3 text-teal-600" />
                EduMind Live Pass
              </div>
              <h3 className="font-display text-xl sm:text-2xl font-black text-ink">
                EduMind Daily Pass (₹1)
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Full 1-day unlimited access to all AI features. Access is valid from payment time until <strong>12:00 AM Midnight</strong>.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="rounded-2xl bg-gradient-to-br from-teal-50/70 via-stone-50 to-indigo-50/60 p-3.5 border border-teal-100 space-y-2 text-xs text-stone-800">
              <div className="flex items-center gap-2 text-teal-950 font-semibold">
                <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Instant access across your entire day</span>
              </div>
              <ul className="space-y-1.5 pl-6 list-disc text-stone-600 text-[11px]">
                <li>Smart OCR scanner for textbook pages &amp; notes</li>
                <li>University standard 2, 3, 8 &amp; 12-mark exam answers</li>
                <li>Spoken theory &amp; conversational audio stories</li>
                <li>Valid until <strong>12:00 AM Midnight</strong></li>
              </ul>
            </div>

            {/* Payment Summary Box */}
            <div className="space-y-3 rounded-2xl border-2 border-teal-500/40 bg-teal-50/60 p-4 text-center">
              <div className="flex items-baseline justify-between border-b border-teal-200/80 pb-2">
                <div className="text-left">
                  <span className="text-xs font-semibold text-stone-700 block">Total Payable:</span>
                  <span className="text-[10px] text-teal-800 font-medium">Valid until 12:00 AM Midnight</span>
                </div>
                <span className="font-display text-3xl font-black text-teal-950">₹{PASS_AMOUNT_RUPEES}.00</span>
              </div>

              <button
                type="button"
                onClick={handleRazorpayPayment}
                disabled={processing}
                className="btn-primary w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 via-teal-700 to-indigo-700 hover:from-teal-700 hover:to-indigo-800 text-white font-bold py-3.5 shadow-lg shadow-teal-700/25 rounded-2xl text-sm transition-all cursor-pointer"
              >
                {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
                {processing ? 'Connecting to Razorpay...' : `Pay ₹${PASS_AMOUNT_RUPEES} via UPI / QR / Card`}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-500 font-medium">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Secured 256-bit Live Payment via Razorpay</span>
              </div>
            </div>

            {error && <ErrorNotice message={error} />}

            <button type="button" onClick={onClose} disabled={processing} className="btn-secondary w-full text-xs py-2.5 rounded-xl">
              {t('cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
