import apiClient from "@/lib/api-client";

/**
 * Razorpay Checkout.js integration.
 *
 * The server creates the gateway order (POST /payments/initiate or /wallet/add-money) and returns `GatewayDetails`.
 * `runCheckout` opens Checkout.js, and `verifyPayment` posts the signed result back so the server can confirm it.
 * When the backend runs with its in-memory FAKE gateway (no Razorpay keys, development only) there is no real
 * Checkout: the flow auto-completes with a fake signature the fake gateway accepts.
 */

export interface GatewayDetails {
  name: "razorpay" | "fake";
  keyId: string;
  gatewayOrderId: string;
  amountPaise: number;
  currency: string;
}

export interface CheckoutResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export type CheckoutOutcome =
  | { status: "paid"; result: CheckoutResult }
  | { status: "cancelled" }
  | { status: "failed"; message: string };

interface RazorpayCheckoutOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; contact?: string; email?: string };
  theme?: { color?: string };
  handler: (response: CheckoutResult) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", cb: (response: { error?: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    if (!existing) {
      script.src = CHECKOUT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

export async function runCheckout(
  details: GatewayDetails,
  opts: { description?: string; prefill?: { name?: string; contact?: string; email?: string } } = {},
): Promise<CheckoutOutcome> {
  if (details.name === "fake") {
    // Development with no Razorpay keys: simulate a successful payment.
    return {
      status: "paid",
      result: {
        razorpay_order_id: details.gatewayOrderId,
        razorpay_payment_id: `pay_fake_${Math.random().toString(36).slice(2, 12)}`,
        razorpay_signature: "fake",
      },
    };
  }

  const loaded = await loadCheckoutScript();
  if (!loaded || !window.Razorpay) {
    return { status: "failed", message: "Could not load the payment window. Check your connection and try again." };
  }
  const Razorpay = window.Razorpay;

  return new Promise<CheckoutOutcome>((resolve) => {
    const instance = new Razorpay({
      key: details.keyId,
      order_id: details.gatewayOrderId,
      amount: details.amountPaise,
      currency: details.currency,
      name: "Kisaan Bazaar",
      description: opts.description,
      prefill: opts.prefill,
      theme: { color: "#047857" },
      handler: (result) => resolve({ status: "paid", result }),
      modal: { ondismiss: () => resolve({ status: "cancelled" }) },
    });
    instance.on("payment.failed", (response) =>
      resolve({ status: "failed", message: response.error?.description ?? "Payment failed" }),
    );
    instance.open();
  });
}

/** Posts the Checkout result to the server, which checks the signature and confirms the payment. */
export async function verifyPayment(paymentId: string, result: CheckoutResult): Promise<void> {
  await apiClient.post("/payments/verify", { paymentId, ...result });
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string; error?: { message?: string } } } };
  return e.response?.data?.message ?? e.response?.data?.error?.message ?? fallback;
}
