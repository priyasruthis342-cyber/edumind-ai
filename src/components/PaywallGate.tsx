import { useEffect, useState, type ReactNode } from 'react';
import {
  CheckCircle2, Crown, Loader2, Lock, ScanLine, Music,
  ClipboardCheck, X, CreditCard, ShieldCheck, QrCode, Copy, Check, Info, Sparkles
} from 'lucide-react';
import { useApp } from '@/context/useApp';
import {
  createPaymentReference, buildPaymentQrDataUrl, PASS_AMOUNT_RUPEES,
  startRazorpayCheckout, RAZORPAY_TEST_KEY_ID, isPaymentPassActive
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
              Rs.1 / day
            </span>
            <h2 className="text-2xl font-semibold sm:text-3xl">{t('payTitle')}</h2>
            <p className="text-sm leading-relaxed text-stone-700 sm:text-base">{t('payBody')}</p>
            <ul className="space-y-2.5 text-sm text-stone-800">
              <li className="flex items-center gap-2.5">
                <ScanLine className="h-4 w-4 text-teal-700" aria-hidden /> Smart page and PDF scanner
              </li>
              <li className="flex items-center gap-2.5">
                <Music className="h-4 w-4 text-teal-700" aria-hidden /> Story and rhythm audio lessons
              </li>
              <li className="flex items-center gap-2.5">
                <ClipboardCheck className="h-4 w-4 text-teal-700" aria-hidden /> 25 to 35 question practice tests
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
  const [reference] = useState(createPaymentReference);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    setTimeout(() => setCopiedItem(null), 2500);
  };

  const handleSimulateInstantSuccess = async () => {
    setProcessing(true);
    setError(null);
    try {
      const mockPayId = `pay_sim_${Date.now()}`;
      await payForToday(mockPayId);
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Simulation failed.');
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    let active = true;
    buildPaymentQrDataUrl(reference)
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {
        if (active) setError(t('error'));
      });
    return () => {
      active = false;
    };
  }, [reference, t]);

  // Razorpay Test Payment Checkout Handler
  const handleRazorpayPayment = async () => {
    setProcessing(true);
    setError(null);
    try {
      await startRazorpayCheckout({
        amountRupees: PASS_AMOUNT_RUPEES,
        onSuccess: async (paymentId: string) => {
          await payForToday(paymentId);
          setDone(true);
          setProcessing(false);
        },
        onError: (err: Error) => {
          setError(err.message || 'Payment was cancelled or failed.');
          setProcessing(false);
        },
        onDismiss: () => {
          setProcessing(false);
        },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not initialize Razorpay checkout.');
      setProcessing(false);
    }
  };

  const confirmManualUpi = async () => {
    setProcessing(true);
    setError(null);
    try {
      await payForToday(reference);
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('error'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <div className="max-h-[90vh] w-full max-w-md animate-pop overflow-y-auto rounded-2xl bg-white p-6 shadow-lift sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                Razorpay Test Mode
              </span>
            </div>
            <h3 id="checkout-title" className="mt-1 text-xl font-bold text-ink">
              Edumind Daily Pass (₹{PASS_AMOUNT_RUPEES})
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Instant access to AI syllabus scanner, exam answers & audio lessons.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('close')} className="rounded-lg p-1.5 text-stone-600 hover:bg-stone-100 hover:text-ink">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {done ? (
          <div className="mt-6 space-y-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-10 w-10" aria-hidden />
            </div>
            <div>
              <h4 className="text-lg font-bold text-ink">Payment Successful!</h4>
              <p className="text-xs text-stone-600 mt-1">
                Your Edumind Daily Pass is now active for today. Happy studying!
              </p>
            </div>
            <button type="button" onClick={onPaid} className="btn-primary w-full py-3 font-bold">
              <ScanLine className="h-4 w-4" aria-hidden />
              Continue to Study & Scanner
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {/* Prominent Test Simulation Box with Test UPI & Test Card */}
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/80 p-4 text-left space-y-3 shadow-xs">
              <div className="flex items-start gap-2.5">
                <Info className="h-5 w-5 text-amber-800 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                    Razorpay Test Simulation Credentials
                  </h4>
                  <p className="text-[11px] text-amber-900/90 leading-relaxed mt-0.5">
                    <strong>Note:</strong> Scanning the test QR with real phone UPI apps (GPay, PhonePe, Paytm) will show <em>"Invalid QR"</em> because this is a test sandbox. Instead, use the official Razorpay test credentials below:
                  </p>
                </div>
              </div>

              {/* Option A: Test UPI ID */}
              <div className="rounded-xl bg-white p-3 border border-amber-200/90 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-teal-600" /> Standard Test UPI ID (100% Success)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('success@razorpay', 'upi')}
                    className="flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200 transition-colors cursor-pointer"
                  >
                    {copiedItem === 'upi' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    {copiedItem === 'upi' ? 'Copied!' : 'Copy UPI'}
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs font-mono font-bold text-teal-950 bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200">
                  <span>success@razorpay</span>
                  <span className="text-[10px] font-sans font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Auto-Approve
                  </span>
                </div>
                <p className="text-[10px] text-stone-500 leading-tight">
                  In Razorpay modal: Click <strong>UPI</strong> → Paste <code>success@razorpay</code> → Click <strong>Pay</strong>.
                </p>
              </div>

              {/* Option B: Test Card */}
              <div className="rounded-xl bg-white p-3 border border-amber-200/90 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-indigo-600" /> Standard Test Card
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('4111111111111111', 'card')}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 transition-colors cursor-pointer"
                  >
                    {copiedItem === 'card' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    {copiedItem === 'card' ? 'Copied!' : 'Copy Card'}
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs font-mono font-bold text-stone-900 bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200">
                  <span>4111 1111 1111 1111</span>
                  <span className="text-[10px] text-stone-600">Exp: 12/28 | CVV: 123</span>
                </div>
                <p className="text-[10px] text-stone-500 leading-tight">
                  In Razorpay modal: Click <strong>Cards</strong> → Enter card → Click <strong>Success</strong> on simulated OTP screen.
                </p>
              </div>
            </div>

            {/* Launch Razorpay Modal Box */}
            <div className="space-y-2.5 rounded-2xl border-2 border-teal-500/30 bg-teal-50/50 p-4 text-center">
              <div className="flex items-baseline justify-between border-b border-teal-200/60 pb-2">
                <span className="text-xs font-semibold text-stone-700">Total Payable:</span>
                <span className="font-display text-2xl font-black text-teal-900">₹{PASS_AMOUNT_RUPEES}.00</span>
              </div>

              <button
                type="button"
                onClick={handleRazorpayPayment}
                disabled={processing}
                className="btn-primary w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white font-bold py-3.5 shadow-md rounded-xl text-sm transition-all cursor-pointer"
              >
                {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
                {processing ? 'Launching Razorpay...' : `Pay ₹${PASS_AMOUNT_RUPEES} via Razorpay Modal`}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-500 font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Key ID: <code className="bg-stone-200 px-1 py-0.5 rounded text-[10px] text-stone-700">{RAZORPAY_TEST_KEY_ID}</code>
              </div>
            </div>

            {/* Quick One-Click Instant Test Bypass (for Reviewers / Developers) */}
            <button
              type="button"
              onClick={handleSimulateInstantSuccess}
              disabled={processing}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100/80 px-3 py-2.5 text-xs font-bold text-emerald-900 transition-all cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-emerald-600" />
              ⚡ Instant 1-Click Test Pass (Skip to Study)
            </button>

            {error && <ErrorNotice message={error} />}

            {/* Alternative: QR Code display toggle */}
            <div className="border-t border-stone-200 pt-2">
              <button
                type="button"
                onClick={() => setShowQr(!showQr)}
                className="flex items-center justify-between w-full text-[11px] font-semibold text-stone-500 hover:text-teal-700 py-1"
              >
                <span className="flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5" /> View Sandbox UPI QR (Simulation Only)
                </span>
                <span>{showQr ? 'Hide ▲' : 'Show ▼'}</span>
              </button>

              {showQr && (
                <div className="mt-2.5 flex flex-col items-center gap-2.5 rounded-xl bg-stone-50 p-3.5 border border-stone-200 animate-fade-in text-center">
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    ⚠️ Test QR only — Real mobile apps cannot scan test QRs
                  </span>
                  {qrUrl ? (
                    <img src={qrUrl} alt="UPI QR code" className="h-36 w-36 rounded-xl bg-white p-2 shadow-sm" />
                  ) : (
                    <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
                  )}
                  <p className="text-[10px] text-stone-500 font-mono">Ref: {reference}</p>
                  <button
                    type="button"
                    onClick={confirmManualUpi}
                    disabled={processing}
                    className="btn-secondary w-full text-xs py-2"
                  >
                    Confirm Manual Test UPI
                  </button>
                </div>
              )}
            </div>

            <button type="button" onClick={onClose} className="btn-secondary w-full text-xs py-2">
              {t('cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
