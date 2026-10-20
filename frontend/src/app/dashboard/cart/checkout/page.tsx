"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useCartStore } from "@/stores/cartStore";
import { useAddressStore } from "@/stores/addressStore";
import apiClient from "@/lib/api-client";
import {
  ShoppingBag,
  Loader2,
  MapPin,
  CreditCard,
  Truck,
  CheckCircle2,
  Package,
  IndianRupee,
  Percent,
  X,
  Plus,
  Banknote,
  BookOpen,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { apiErrorMessage, runCheckout, verifyPayment, type GatewayDetails } from "@/lib/razorpay";
import { useAuthStore } from "@/stores/authStore";
import type { CouponItem, OrderQuote } from "@/types/auth";
import { formatRupees, isZero } from "@/lib/money";
import { stateNameFromCode } from "@/lib/indianStates";

// ─── Payment methods ─────────────────────────────────────────────────────────

interface PaymentMethodOption {
  value: string;
  label: string;
  description: string;
  icon: typeof CreditCard;
  requiresKhata?: boolean;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  { value: "COD", label: "Cash on Delivery", description: "Pay when you receive", icon: Truck },
  { value: "UPI", label: "UPI", description: "Google Pay, PhonePe, Paytm", icon: CreditCard },
  { value: "CARD", label: "Card", description: "Credit / Debit card", icon: CreditCard },
  { value: "NET_BANKING", label: "Net Banking", description: "All major banks", icon: Banknote },
  { value: "WALLET", label: "Wallet", description: "Pay using your wallet balance", icon: CreditCard },
  { value: "KHATA_CREDIT", label: "Khata Credit", description: "Pay later with your khata account", icon: BookOpen, requiresKhata: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type CheckoutStep = "review" | "address" | "payment" | "confirming" | "payment_pending" | "success";

const ONLINE_METHODS = ["UPI", "CARD", "NET_BANKING"];

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({
  steps,
  currentStep,
}: {
  steps: { key: CheckoutStep; label: string }[];
  currentStep: CheckoutStep;
}) {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);
  const beforeConfirming = currentStep === "confirming" || currentStep === "success";

  return (
    <div className="mb-8 flex items-center justify-center gap-0">
      {steps.slice(0, 3).map((step, i) => {
        const isActive =
          step.key === currentStep || (beforeConfirming && i === 2) ||
          (currentStep === "confirming" && i <= 2);
        const isCompleted = i < currentIndex || (beforeConfirming && i <= 2);
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  isCompleted
                    ? "bg-emerald-600 text-white"
                    : isActive
                      ? "border-2 border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500"
                }`}
              >
                {isCompleted ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span
                className={`mt-1.5 text-[10px] font-medium ${
                  isActive ? "text-emerald-700 dark:text-emerald-400" : "text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < 2 && (
              <div
                className={`mx-2 mt-[-20px] h-px w-12 sm:w-20 ${
                  i < currentIndex || (beforeConfirming && i < 2)
                    ? "bg-emerald-400"
                    : "bg-gray-200 dark:bg-gray-600 dark:bg-gray-600"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({
  orderNumber,
  onViewOrders,
  onShopAgain,
}: {
  orderNumber: string;
  onViewOrders: () => void;
  onShopAgain: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600">
          <CheckCircle2 size={36} className="text-white" />
        </div>
      </div>
      <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Order Placed Successfully!</h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
        Your order <span className="font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">#{orderNumber}</span> has been placed
      </p>

      <div className="mt-8 flex flex-col items-center gap-4">
        <div className="flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 px-4 py-2 text-sm">
          <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-emerald-800 dark:text-emerald-300 font-medium">
            You&apos;ll receive a confirmation shortly
          </span>
        </div>

        <div className="mt-2 flex gap-3">
          <button
            onClick={onViewOrders}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow transition-all hover:bg-emerald-800"
          >
            <Package size={16} />
            View My Orders
          </button>
          <button
            onClick={onShopAgain}
            className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-6 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50"
          >
            <ShoppingBag size={16} />
            Shop Again
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, isLoading, getCart, createOrder } = useCartStore();
  const {
    addresses,
    isLoading: addressesLoading,
    fetchAddresses,
  } = useAddressStore();

  const [step, setStep] = useState<CheckoutStep>("review");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("COD");
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [placedOrderNumber, setPlacedOrderNumber] = useState("");
  const [placedOrderId, setPlacedOrderId] = useState("");
  const [paymentIssue, setPaymentIssue] = useState("");
  const user = useAuthStore((s) => s.user);

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponItem | null>(null);
  const [couponError, setCouponError] = useState("");
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Load data on mount
  useEffect(() => {
    getCart().catch(() => {
      toast.error("Failed to load cart");
      router.push("/dashboard/cart");
    });
    fetchAddresses(1, 50).catch(() => {});
  }, [getCart, fetchAddresses, router]);

  // Auto-select default address
  useEffect(() => {
    if (!selectedAddressId && addresses.length > 0) {
      const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedAddressId(defaultAddr.id);
    }
  }, [addresses, selectedAddressId]);

  // ── Computed values ──

  const items = useMemo(() => cart?.items ?? [], [cart]);
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.variant.sellingPrice * item.quantity, 0),
    [items],
  );

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === "PERCENTAGE") {
      const discount = (subtotal * appliedCoupon.value) / 100;
      return appliedCoupon.maximumDiscount
        ? Math.min(discount, appliedCoupon.maximumDiscount)
        : discount;
    }
    if (appliedCoupon.type === "FIXED") return appliedCoupon.value;
    if (appliedCoupon.type === "FREE_DELIVERY") return 0;
    return 0;
  }, [appliedCoupon, subtotal]);

  // The server quote (per-seller split, GST, delivery) is authoritative. The local numbers below are only a
  // rough fallback shown before an address is chosen; they ignore GST and per-seller delivery.
  const fallbackDelivery = subtotal >= 500 || appliedCoupon?.type === "FREE_DELIVERY" ? 0 : 40;
  const deliveryCharge = quote ? Number(quote.totals.deliveryCharge) : fallbackDelivery;
  const total = quote ? Number(quote.totals.totalAmount) : Math.max(0, subtotal - discountAmount + fallbackDelivery);
  const quoteDiscount = quote ? Number(quote.totals.discountAmount) : discountAmount;
  const khataReady = !!quote && quote.subOrders.every((so) => so.khata?.usable);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
  const canPlaceOrder =
    !!selectedAddressId &&
    items.length > 0 &&
    !!quote &&
    (paymentMethod !== "KHATA_CREDIT" || khataReady);

  // Fetch the quote whenever the address or coupon changes.
  useEffect(() => {
    if (!selectedAddressId || items.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuote(null);
      return;
    }
    let cancelled = false;
    apiClient
      .post<{ success: boolean; data: OrderQuote }>("/orders/quote", {
        addressId: selectedAddressId,
        couponCode: appliedCoupon?.code || undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setQuote(res.data.data);
        setQuoteError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(apiErrorMessage(err, "Could not price this order"));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAddressId, appliedCoupon, items.length]);

  // ── Coupon handlers ──

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsValidatingCoupon(true);
    setCouponError("");

    try {
      const res = await apiClient.post<{
        success: boolean;
        data: {
          valid: boolean;
          coupon: CouponItem;
          discount: number;
          remainingAmount: number;
        };
      }>("/coupons/validate", {
        code: couponCode.trim().toUpperCase(),
        subtotal,
      });

      const { coupon, discount } = res.data.data;
      setAppliedCoupon(coupon);
      setCouponCode(coupon.code);
      // Store the validated discount for display
      toast.success(`Coupon applied! You save ${formatCurrency(discount)}`);
    } catch {
      setCouponError("Invalid or expired coupon code");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  // ── Place order ──

  /**
   * Online payment for an order that already exists: ask the server for a gateway order, open Razorpay Checkout,
   * then post the signed result back for verification. Cancel/failure leaves the order PENDING and offers a retry.
   */
  const payOnline = async (orderId: string, orderNumber: string, method: string) => {
    setStep("confirming");
    setPaymentIssue("");
    try {
      const init = await apiClient.post<{
        success: boolean;
        data: { payment: { id: string }; gateway: GatewayDetails };
      }>("/payments/initiate", { orderId, paymentMethod: method });
      const { payment, gateway } = init.data.data;

      const outcome = await runCheckout(gateway, {
        description: `Order ${orderNumber}`,
        prefill: { name: user?.fullName, contact: user?.phoneNumber, email: user?.email ?? undefined },
      });
      if (outcome.status === "cancelled") {
        setPaymentIssue("You closed the payment window before paying. Your order is saved and waiting for payment.");
        setStep("payment_pending");
        return;
      }
      if (outcome.status === "failed") {
        setPaymentIssue(outcome.message);
        setStep("payment_pending");
        return;
      }
      await verifyPayment(payment.id, outcome.result);
      setStep("success");
      toast.success("Payment received. Order confirmed!");
    } catch (err: unknown) {
      setPaymentIssue(apiErrorMessage(err, "We could not complete the payment. You have not been charged twice."));
      setStep("payment_pending");
    }
  };

  const handlePlaceOrder = async () => {
    if (!canPlaceOrder) return;
    setStep("confirming");
    setIsPlacingOrder(true);

    try {
      const order = await createOrder({
        addressId: selectedAddressId!,
        paymentMethod,
        couponCode: appliedCoupon?.code || undefined,
      });
      setPlacedOrderNumber(order.orderNumber);
      setPlacedOrderId(order.id);
      // Store last order ID for the confirmation page
      sessionStorage.setItem("lastOrderId", order.id);
      sessionStorage.setItem("lastOrderNumber", order.orderNumber);

      if (ONLINE_METHODS.includes(paymentMethod)) {
        // The order exists now (stock is held); collect the money.
        await payOnline(order.id, order.orderNumber, paymentMethod);
        return;
      }
      if (paymentMethod === "COD") {
        // Record the expected cash payment; failure here must not undo a placed order.
        apiClient.post("/payments/initiate", { orderId: order.id, paymentMethod: "COD" }).catch(() => {});
      }
      // WALLET is debited atomically at checkout and KHATA_CREDIT is posted to the ledger by the server.
      setStep("success");
      toast.success("Order placed successfully!");
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, "Failed to place order"));
      setStep("payment");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // ── Loading state ──

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
        </div>
      </div>
    );
  }

  // ── Empty cart → redirect ──

  if (!cart || items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
            <ShoppingBag size={36} className="text-gray-300" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Your cart is empty</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Add items to your cart before checking out</p>
          <Link
            href="/products"
            className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-800"
          >
            <ShoppingBag size={16} />
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  // ── Payment pending (cancelled / failed online payment) ──

  if (step === "payment_pending") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center py-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <CreditCard size={32} className="text-amber-700 dark:text-amber-300" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Payment not completed</h2>
          <p className="mt-2 max-w-md text-sm text-gray-600 dark:text-gray-300">{paymentIssue}</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Order <span className="font-semibold">#{placedOrderNumber}</span> is saved. You can retry now or pay later from
            your orders.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() =>
                payOnline(placedOrderId, placedOrderNumber, ONLINE_METHODS.includes(paymentMethod) ? paymentMethod : "UPI")
              }
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-800"
            >
              Retry payment
            </button>
            <button
              onClick={() => router.push(`/dashboard/orders/${placedOrderId}`)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-6 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              View order
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Success state ──

  if (step === "success") {
    return (
      <div className="mx-auto max-w-2xl">
        <SuccessScreen
          orderNumber={placedOrderNumber || "—"}
          onViewOrders={() => router.push("/dashboard/orders")}
          onShopAgain={() => router.push("/products")}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: "Cart", href: "/dashboard/cart" },
          { label: "Checkout" },
        ]}
      />

      {/* Steps */}
      <StepIndicator
        steps={[
          { key: "review", label: "Review" },
          { key: "address", label: "Delivery" },
          { key: "payment", label: "Payment" },
        ]}
        currentStep={step}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Left: Main Content ── */}
        <div className="space-y-5 lg:col-span-3">
          {/* Step 1: Cart review, split by seller with the GST breakup */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Order Items ({items.length})</h3>
              <Link href="/dashboard/cart" className="text-xs font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400">
                Edit Cart
              </Link>
            </div>
            {quoteError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{quoteError}</p>}
            {!quote && !quoteError && (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-700/50 dark:text-gray-300">
                Choose a delivery address to see the price split by seller, with GST and delivery.
              </p>
            )}
            {quote?.subOrders.map((so) => (
              <div key={so.vendorId} className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-700">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Sold by</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{so.vendorName}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {so.interState
                      ? `IGST · ships from ${stateNameFromCode(so.sellerStateCode)}`
                      : `CGST + SGST · same state (${stateNameFromCode(so.sellerStateCode)})`}
                  </span>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-700">
                  {so.lines.map((l) => (
                    <div key={l.variantId} className="flex items-center gap-3 px-5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{l.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {l.variantName ?? "Default"} × {l.quantity} · GST {Number(l.gstRate)}%
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-gray-900 dark:text-gray-100">{formatRupees(l.lineTotal)}</p>
                    </div>
                  ))}
                </div>
                <dl className="space-y-1 border-t border-gray-100 px-5 py-3 text-xs dark:border-gray-700">
                  {!isZero(so.discountAmount) && (
                    <div className="flex justify-between"><dt className="text-gray-500">Coupon discount</dt><dd className="font-medium text-emerald-700 dark:text-emerald-400">−{formatRupees(so.discountAmount)}</dd></div>
                  )}
                  <div className="flex justify-between"><dt className="text-gray-500">Taxable value</dt><dd>{formatRupees(so.taxableValue)}</dd></div>
                  {!isZero(so.cgstAmount) && <div className="flex justify-between"><dt className="text-gray-500">CGST</dt><dd>{formatRupees(so.cgstAmount)}</dd></div>}
                  {!isZero(so.sgstAmount) && <div className="flex justify-between"><dt className="text-gray-500">SGST</dt><dd>{formatRupees(so.sgstAmount)}</dd></div>}
                  {!isZero(so.igstAmount) && <div className="flex justify-between"><dt className="text-gray-500">IGST</dt><dd>{formatRupees(so.igstAmount)}</dd></div>}
                  <div className="flex justify-between"><dt className="text-gray-500">Delivery</dt><dd>{isZero(so.deliveryCharge) ? "Free" : formatRupees(so.deliveryCharge)}</dd></div>
                  <div className="flex justify-between border-t border-gray-100 pt-1.5 text-sm font-bold dark:border-gray-700"><dt>This seller&apos;s total</dt><dd>{formatRupees(so.totalAmount)}</dd></div>
                </dl>
              </div>
            ))}
          </div>

          {/* Step 2: Delivery Address */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 dark:border-gray-700 px-5 py-4">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                    selectedAddress
                      ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300"
                      : "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500"
                  }`}
                >
                  <MapPin size={11} />
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Delivery Address</h3>
              </div>
              <button
                onClick={() => setStep(step === "address" ? "review" : "address")}
                className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                  step === "address" ? "text-emerald-700 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-200"
                }`}
              >
                {step === "address" ? "Collapse" : "Change"}
                <ChevronRight
                  size={13}
                  className={`transition-transform ${step === "address" ? "rotate-90" : ""}`}
                />
              </button>
            </div>

            {step !== "address" && selectedAddress ? (
              <div className="px-5 py-4">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 p-3">
                  {selectedAddress.label && (
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                      {selectedAddress.label}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">
                    {selectedAddress.addressLine1}
                    {selectedAddress.addressLine2 && <>, {selectedAddress.addressLine2}</>}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">
                    {selectedAddress.city}, {selectedAddress.state} — {selectedAddress.pincode}
                  </p>
                  {selectedAddress.isDefault && (
                    <span className="mt-1.5 inline-flex items-center gap-0.5 rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 size={9} />
                      Default
                    </span>
                  )}
                </div>
              </div>
            ) : step === "address" ? (
              <div className="px-5 py-4">
                {addressesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 size={16} className="animate-spin text-emerald-700 dark:text-emerald-400" />
                  </div>
                ) : addresses.length === 0 ? (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30 p-4 text-center">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      No addresses saved yet
                    </p>
                    <Link
                      href="/dashboard/addresses"
                      className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-700 dark:text-amber-400 underline"
                    >
                      <Plus size={14} />
                      Add an address
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {addresses.map((addr) => {
                      const selected = selectedAddressId === addr.id;
                      return (
                        <button
                          key={addr.id}
                          onClick={() => {
                            setSelectedAddressId(addr.id);
                            setStep("payment");
                          }}
                          className={`w-full rounded-lg border p-3 text-left text-xs transition-all ${
                            selected
                              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30"
                              : "border-gray-200 dark:border-gray-700 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 dark:border-gray-600"
                          }`}
                        >
                          {addr.label && (
                            <p className="font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{addr.label}</p>
                          )}
                          <p className="mt-0.5 text-gray-600 dark:text-gray-300 dark:text-gray-300">
                            {addr.addressLine1}{addr.addressLine2 && <>, {addr.addressLine2}</>}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                            {addr.city}, {addr.state} — {addr.pincode}
                          </p>
                          {addr.isDefault && (
                            <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
                              <CheckCircle2 size={9} />
                              Default
                            </span>
                          )}
                        </button>
                      );
                    })}
                    <Link
                      href="/dashboard/addresses"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300"
                    >
                      <Plus size={13} />
                      Add New Address
                    </Link>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Step 3: Payment Method */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 dark:border-gray-700 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                  <CreditCard size={11} />
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Payment Method</h3>
              </div>
              <button
                onClick={() => setStep(step === "payment" ? "address" : "payment")}
                className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                  step === "payment" ? "text-emerald-700 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-200"
                }`}
              >
                {step === "payment" ? "Collapse" : "Change"}
                <ChevronRight
                  size={13}
                  className={`transition-transform ${step === "payment" ? "rotate-90" : ""}`}
                />
              </button>
            </div>

            {step !== "payment" ? (
              <div className="px-5 py-4">
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">
                  <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span>{PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label ?? paymentMethod}</span>
                  {paymentMethod === "KHATA_CREDIT" && khataReady && (
                    <span className="text-gray-400 dark:text-gray-500">· one khata per seller</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="px-5 py-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    const selected = paymentMethod === method.value;
                    const needsKhata = method.requiresKhata;

                    return (
                      <div key={method.value}>
                        <button
                          onClick={() => {
                            setPaymentMethod(method.value);
                          }}
                          className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                            selected
                              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30"
                              : "border-gray-200 dark:border-gray-700 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 dark:border-gray-600"
                          }`}
                        >
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                              selected ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700"
                            }`}
                          >
                            <Icon
                              size={15}
                              className={selected ? "text-emerald-700 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500"}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                              {method.label}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{method.description}</p>
                          </div>
                        </button>

                        {/* Khata: each seller's own account is charged for that seller's part */}
                        {selected && needsKhata && (
                          <div className="ml-8 mt-2 space-y-1.5">
                            {!quote ? (
                              <p className="text-xs italic text-amber-600 dark:text-amber-400">Choose a delivery address to see your khata with each seller</p>
                            ) : (
                              quote.subOrders.map((so) => (
                                <div
                                  key={so.vendorId}
                                  className={`flex items-center justify-between rounded-lg border p-2.5 text-xs ${
                                    so.khata?.usable
                                      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                                      : "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <BookOpen size={13} />
                                    {so.vendorName}
                                  </span>
                                  <span className="font-medium">
                                    {!so.khata
                                      ? "No khata account"
                                      : !so.khata.usable
                                        ? "Khata not active"
                                        : `${formatRupees(so.khata.available)} available · this part ${formatRupees(so.totalAmount)}`}
                                  </span>
                                </div>
                              ))
                            )}
                            {quote && !khataReady && (
                              <p className="text-xs text-amber-700 dark:text-amber-400">
                                Khata needs an active account with every seller in this order. Pick another method or split your cart.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Order Summary ── */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 space-y-4">
            {/* Coupon Card */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
              <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Coupon</h3>

              {appliedCoupon ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <Percent size={14} className="text-emerald-700 dark:text-emerald-400" />
                      <div>
                        <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{appliedCoupon.code}</p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{appliedCoupon.title}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveCoupon}
                      className="rounded-lg p-1 text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Discount</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      -{formatCurrency(discountAmount)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCouponError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleApplyCoupon();
                      }
                    }}
                    placeholder="Enter coupon code"
                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20 uppercase"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={!couponCode.trim() || isValidatingCoupon}
                    className="rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-bold text-white shadow transition-all hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isValidatingCoupon ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      "Apply"
                    )}
                  </button>
                </div>
              )}
              {couponError && (
                <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{couponError}</p>
              )}
            </div>

            {/* Price Summary */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
              <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Price Breakdown</h3>

              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Subtotal ({items.length} item{items.length !== 1 ? "s" : ""})</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{formatRupees(quote ? quote.totals.subtotal : subtotal)}</span>
                </div>
                {quoteDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">Discount</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">−{formatRupees(quoteDiscount)}</span>
                  </div>
                )}
                {quote && !isZero(quote.totals.cgstAmount) && (
                  <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-300">CGST</span><span className="font-medium">{formatRupees(quote.totals.cgstAmount)}</span></div>
                )}
                {quote && !isZero(quote.totals.sgstAmount) && (
                  <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-300">SGST</span><span className="font-medium">{formatRupees(quote.totals.sgstAmount)}</span></div>
                )}
                {quote && !isZero(quote.totals.igstAmount) && (
                  <div className="flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-300">IGST</span><span className="font-medium">{formatRupees(quote.totals.igstAmount)}</span></div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Delivery</span>
                  <span className={`font-medium ${deliveryCharge === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-gray-900 dark:text-gray-100"}`}>
                    {deliveryCharge === 0 ? "Free" : formatRupees(deliveryCharge)}
                  </span>
                </div>
                {quote && quote.subOrders.length > 1 && (
                  <p className="text-[10px] text-gray-400">Delivery is charged per seller (free per seller above ₹500).</p>
                )}
                <div className="border-t border-gray-100 dark:border-gray-700 dark:border-gray-700 pt-3">
                  <div className="flex justify-between text-base font-bold">
                    <span className="text-gray-900 dark:text-gray-100 dark:text-gray-100">Total</span>
                    <span className="text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Place Order */}
            <button
              onClick={handlePlaceOrder}
              disabled={!canPlaceOrder || isPlacingOrder}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow transition-all hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPlacingOrder ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <IndianRupee size={18} />
              )}
              {isPlacingOrder
                ? "Placing Order..."
                : `Place Order — ${formatCurrency(total)}`}
            </button>

            {/* Trust badges */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-950/30">
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                <div className="flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600 dark:text-emerald-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span>Secure checkout</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600 dark:text-emerald-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span>Buyer protection</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
