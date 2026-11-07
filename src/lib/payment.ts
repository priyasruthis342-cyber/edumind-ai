import QRCode from 'qrcode';
import { getBackendUrl } from './apiConfig';

export const PASS_AMOUNT_RUPEES = 1;
export const PASS_AMOUNT_PAISE = 100;
export const PAYMENT_PAYEE_NAME = 'EduMind AI';
export const PAYMENT_UPI_ID = 'edumind@upi';

const BACKEND_URL = getBackendUrl();
export const RAZORPAY_TEST_KEY_ID = (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined) || 'rzp_test_TwxrpdkuvcZNdH';

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
// 24-Hour Daily Pass Persistence Manager
// ─────────────────────────────────────────────
export const PAYMENT_PASS_KEY = 'edumind_payment_pass_v2';
export const PASS_DURATION_MS = 24 * 60 * 60 * 1000; // Full 24 Hours in ms

export interface StoredPaymentPass {
  paid: boolean;
  reference: string;
  paidAt: number;
  expiresAt: number;
}

export function savePaymentPass(reference: string): StoredPaymentPass {
  const now = Date.now();
  const pass: StoredPaymentPass = {
    paid: true,
    reference,
    paidAt: now,
    expiresAt: now + PASS_DURATION_MS,
  };
  try {
    localStorage.setItem(PAYMENT_PASS_KEY, JSON.stringify(pass));
    localStorage.setItem('edumind_paid_today', 'true');
    localStorage.setItem('edumind_paid_until', String(pass.expiresAt));
  } catch (err) {
    console.error('Failed to save payment pass:', err);
  }
  return pass;
}

export function isPaymentPassActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(PAYMENT_PASS_KEY);
    if (raw) {
      const pass: StoredPaymentPass = JSON.parse(raw);
      if (pass && pass.paid && typeof pass.expiresAt === 'number') {
        if (Date.now() < pass.expiresAt) {
          return true;
        } else {
          localStorage.removeItem(PAYMENT_PASS_KEY);
          localStorage.removeItem('edumind_paid_today');
          return false;
        }
      }
    }
    const until = localStorage.getItem('edumind_paid_until');
    if (until && Number(until) > Date.now()) {
      return true;
    }
  } catch (e) {
    void e;
  }
  return false;
}

// ─────────────────────────────────────────────
// Razorpay Standard Checkout Integration
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
 * Dynamically loads the Razorpay checkout.js script if not present
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
}

export interface RazorpaySuccessPayload {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/**
 * Creates an order on backend with Razorpay Test API
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
  } catch {
    // If backend is unreachable, return fallback test order structure
    return {
      success: true,
      order_id: `order_test_${Date.now()}`,
      amount: amountPaise,
      currency: 'INR',
      key_id: RAZORPAY_TEST_KEY_ID,
    };
  }
}

/**
 * Verifies the signature with the backend
 */
export async function verifyRazorpayPayment(payload: RazorpaySuccessPayload): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/payment/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success && data.verified);
  } catch {
    return Boolean(payload.razorpay_payment_id);
  }
}

export interface StartRazorpayCheckoutOptions {
  amountRupees?: number;
  onSuccess: (paymentId: string) => void;
  onError?: (err: Error) => void;
  onDismiss?: () => void;
}

/**
 * Initializes and opens the Razorpay Test Checkout modal
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
  let userName = 'Scholar';
  let userMobile = '9999999999';
  const userEmail = 'student@edumind.ai';
  try {
    const userRaw = localStorage.getItem('edumind_custom_user');
    if (userRaw) {
      const user = JSON.parse(userRaw);
      if (user.name) userName = user.name;
      if (user.mobile) userMobile = user.mobile;
    }
  } catch (e) {
    void e;
  }

  const order = await createRazorpayOrder(amountRupees * 100);

  const options = {
    key: order.key_id || RAZORPAY_TEST_KEY_ID,
    amount: order.amount || amountRupees * 100,
    currency: order.currency || 'INR',
    name: 'EduMind AI',
    description: 'Test Mode: Use UPI (success@razorpay) or Card (4111 1111 1111 1111)',
    image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
    order_id: order.order_id && !order.order_id.startsWith('order_test_') ? order.order_id : undefined,
    handler: async function (response: RazorpaySuccessPayload) {
      try {
        if (response.razorpay_signature && order.order_id) {
          await verifyRazorpayPayment(response);
        }
        onSuccess(response.razorpay_payment_id || `pay_${Date.now()}`);
      } catch {
        onSuccess(response.razorpay_payment_id || `pay_${Date.now()}`);
      }
    },
    prefill: {
      name: userName,
      contact: userMobile,
      email: userEmail,
      vpa: 'success@razorpay',
    },
    notes: {
      app: 'EduMind AI',
      purpose: 'Daily Pass Subscription Test',
      test_upi_id: 'success@razorpay',
      test_card: '4111 1111 1111 1111 (CVV 123, Exp 12/28)',
      instructions: 'Do not scan QR with phone apps. Select UPI (success@razorpay) or Card (4111 1111 1111 1111).',
    },
    theme: {
      color: '#0d9488', // Teal brand color
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
      const err = new Error(resp.error?.description || 'Payment failed on Razorpay.');
      onError?.(err);
    });
    rzp.open();
  }
}
