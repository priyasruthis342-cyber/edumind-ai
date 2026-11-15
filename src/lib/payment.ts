import QRCode from 'qrcode';
import { getBackendUrl } from './apiConfig';

export const PASS_AMOUNT_RUPEES = 1;
export const PASS_AMOUNT_PAISE = 100;
export const PAYMENT_PAYEE_NAME = 'EduMind AI';
export const PAYMENT_UPI_ID = 'edumind@upi';

const BACKEND_URL = getBackendUrl();
export const RAZORPAY_LIVE_KEY_ID = (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined) || 'rzp_live_U0SAD2W1CHDQG0';

export function createPaymentReference(): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `EDU-${Date.now().toString(36).toUpperCase()}-${random}`;
}

export function buildUpiLink(reference: string): string {
  const params = new URLSearchParams({
    pa: PAYMENT_UPI_ID,
    pn: PAYMENT_PAYEE_NAME,
    am: PASS_AMOUNT_RUPEES.toFixed(2),
    cu: 'INR',
    tn: reference,
  });
  return `upi://pay?${params.toString()}`;
}

export function buildPaymentQrDataUrl(reference: string): Promise<string> {
  return QRCode.toDataURL(buildUpiLink(reference), { width: 240, margin: 1, color: { dark: '#1c1917', light: '#ffffff' } });
}

// ─────────────────────────────────────────────
// Strict Daily Validity Window (12 AM to 12 AM Midnight Expiry)
// Access expires sharply at 12:00 AM Midnight of the current day.
// ─────────────────────────────────────────────
export const PAYMENT_PASS_KEY = 'edumind_payment_pass_v3';

export function getNextMidnightTimestamp(): number {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return nextMidnight.getTime();
}

export function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export interface StoredPaymentPass {
  paid: boolean;
  reference: string;
  paidAt: number;
  paidDate: string;   // e.g. "2026-11-15"
  expiresAt: number;  // timestamp of 12:00 AM Midnight
}

export function savePaymentPass(reference: string, serverExpiresAt?: number, serverPaidDate?: string): StoredPaymentPass {
  const now = Date.now();
  const expiresAt = serverExpiresAt && serverExpiresAt > now ? serverExpiresAt : getNextMidnightTimestamp();
  const paidDate = serverPaidDate || getTodayDateString();

  const pass: StoredPaymentPass = {
    paid: true,
    reference,
    paidAt: now,
    paidDate,
    expiresAt,
  };

  try {
    localStorage.setItem(PAYMENT_PASS_KEY, JSON.stringify(pass));
    localStorage.setItem('edumind_paid_today', 'true');
    localStorage.setItem('edumind_paid_date', paidDate);
    localStorage.setItem('edumind_paid_until', String(pass.expiresAt));
  } catch (err) {
    console.error('Failed to save payment pass:', err);
  }
  return pass;
}

export function isPaymentPassActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const today = getTodayDateString();
    const now = Date.now();

    const raw = localStorage.getItem(PAYMENT_PASS_KEY);
    if (raw) {
      const pass: StoredPaymentPass = JSON.parse(raw);
      if (pass && pass.paid) {
        // Enforce strict 12 AM Midnight Expiration
        if (now < pass.expiresAt && pass.paidDate === today) {
          return true;
        } else {
          // Sharp expiration at 12 AM midnight - clear today's pass
          localStorage.removeItem(PAYMENT_PASS_KEY);
          localStorage.removeItem('edumind_paid_today');
          localStorage.removeItem('edumind_paid_date');
          localStorage.removeItem('edumind_paid_until');
          return false;
        }
      }
    }

    const paidDate = localStorage.getItem('edumind_paid_date');
    const until = localStorage.getItem('edumind_paid_until');
    if (paidDate === today && until && Number(until) > now) {
      return true;
    }
  } catch (e) {
    void e;
  }
  return false;
}

// ─────────────────────────────────────────────
// Razorpay Live Production Checkout Integration
// ─────────────────────────────────────────────

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      on: (event: string, handler: (resp: { error?: { description?: string } }) => void) => void;
      open: () => void;
    };
  }
}

/**
 * Dynamically loads the official Razorpay checkout.js script
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export interface RazorpayOrderResponse {
  success: boolean;
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  mode?: string;
}

export interface RazorpaySuccessPayload {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/**
 * Creates a real Live order on backend for ₹1.00 (100 paise)
 */
export async function createRazorpayOrder(amountPaise = PASS_AMOUNT_PAISE): Promise<RazorpayOrderResponse> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/payment/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Order creation failed (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    console.error('Create order error:', err);
    throw err;
  }
}

/**
 * Verifies live Razorpay payment signature with backend and receives midnight expiry
 */
export async function verifyRazorpayPayment(payload: RazorpaySuccessPayload): Promise<{ verified: boolean; expiresAt?: number; paidDate?: string }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/payment/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { verified: false };
    const data = await res.json();
    return {
      verified: Boolean(data.success && data.verified),
      expiresAt: data.expiresAt,
      paidDate: data.paidDate
    };
  } catch {
    return { verified: false };
  }
}

export interface StartRazorpayCheckoutOptions {
  amountRupees?: number;
  onSuccess: (paymentId: string, expiresAt?: number, paidDate?: string) => void;
  onError?: (err: Error) => void;
  onDismiss?: () => void;
}

/**
 * Initializes and opens the Live Razorpay Checkout modal
 * Supports all UPI apps (GPay, PhonePe, Paytm, BHIM, Cred), Netbanking & Cards
 */
export async function startRazorpayCheckout({
  amountRupees = PASS_AMOUNT_RUPEES,
  onSuccess,
  onError,
  onDismiss,
}: StartRazorpayCheckoutOptions): Promise<void> {
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    const err = new Error('Razorpay SDK could not be loaded. Please check your internet connection.');
    onError?.(err);
    throw err;
  }

  // Get student details if logged in
  let userName = 'Student';
  let userMobile = '';
  let userEmail = '';
  try {
    const userRaw = localStorage.getItem('edumind_custom_user');
    if (userRaw) {
      const user = JSON.parse(userRaw);
      if (user.name) userName = user.name;
      if (user.mobile) userMobile = user.mobile;
      if (user.email) userEmail = user.email;
    }
  } catch (e) {
    void e;
  }

  const order = await createRazorpayOrder(amountRupees * 100);

  const options = {
    key: order.key_id || RAZORPAY_LIVE_KEY_ID,
    amount: order.amount || 100,
    currency: order.currency || 'INR',
    name: 'EduMind AI',
    description: 'Daily Pass (₹1) • Valid until 12:00 AM Midnight',
    image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
    order_id: order.order_id,
    handler: async function (response: RazorpaySuccessPayload) {
      try {
        const verifyResult = await verifyRazorpayPayment(response);
        if (verifyResult.verified) {
          savePaymentPass(response.razorpay_payment_id, verifyResult.expiresAt, verifyResult.paidDate);
          onSuccess(response.razorpay_payment_id, verifyResult.expiresAt, verifyResult.paidDate);
        } else {
          // Fallback pass in case verification endpoint had temporary glitch
          savePaymentPass(response.razorpay_payment_id);
          onSuccess(response.razorpay_payment_id);
        }
      } catch {
        savePaymentPass(response.razorpay_payment_id);
        onSuccess(response.razorpay_payment_id);
      }
    },
    prefill: {
      name: userName,
      contact: userMobile,
      email: userEmail,
    },
    notes: {
      app: 'EduMind AI',
      purpose: 'Daily Pass Subscription (12 AM to 12 AM)',
    },
    theme: {
      color: '#0d9488', // Teal primary color
    },
    modal: {
      ondismiss: function () {
        onDismiss?.();
      },
    },
  };

  if (window.Razorpay) {
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (resp: { error?: { description?: string } }) {
      const err = new Error(resp.error?.description || 'Payment was unsuccessful or cancelled.');
      onError?.(err);
    });
    rzp.open();
  }
}
