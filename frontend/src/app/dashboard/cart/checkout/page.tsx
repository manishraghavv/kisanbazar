"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useCartStore } from "@/stores/cartStore";
import { useAddressStore } from "@/stores/addressStore";
import { useKhataStore } from "@/stores/khataStore";
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
import type { CouponItem } from "@/types/auth";

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

type CheckoutStep = "review" | "address" | "payment" | "confirming" | "success";

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
  const { accounts: khataAccounts, getAccounts } = useKhataStore();

  const [step, setStep] = useState<CheckoutStep>("review");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("COD");
  const [selectedKhataId, setSelectedKhataId] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [placedOrderNumber, setPlacedOrderNumber] = useState("");

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
    getAccounts(1, 50, "ACTIVE").catch(() => {});
  }, [getCart, fetchAddresses, getAccounts, router]);

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

  // Display estimate only: the server computes the authoritative delivery charge (same rule).
  const deliveryCharge = subtotal >= 500 || appliedCoupon?.type === "FREE_DELIVERY" ? 0 : 40;
  const total = Math.max(0, subtotal - discountAmount + deliveryCharge);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
  const canPlaceOrder =
    !!selectedAddressId &&
    items.length > 0 &&
    (paymentMethod !== "KHATA_CREDIT" || !!selectedKhataId);

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

  const handlePlaceOrder = async () => {
    if (!canPlaceOrder) return;
    setStep("confirming");
    setIsPlacingOrder(true);

    try {
      const order = await createOrder({
        addressId: selectedAddressId!,
        paymentMethod,
        khataAccountId: paymentMethod === "KHATA_CREDIT" ? selectedKhataId : null,
        couponCode: appliedCoupon?.code || undefined,
      });
      setPlacedOrderNumber(order.orderNumber);
      setStep("success");
      toast.success("Order placed successfully!");
      // Store last order ID for the confirmation page
      sessionStorage.setItem("lastOrderId", order.id);
      sessionStorage.setItem("lastOrderNumber", order.orderNumber);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to place order");
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
          {/* Step 1: Cart Review */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 dark:border-gray-700 px-5 py-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                Order Items ({items.length})
              </h3>
              <Link
                href="/dashboard/cart"
                className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300"
              >
                Edit Cart
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {items.map((item) => {
                const imageUrl = item.variant.product.images[0]?.imageUrl;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
                      {imageUrl ? (
                        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Package size={18} className="text-gray-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 line-clamp-1">
                        {item.variant.product.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                        {item.variant.variantName ?? "Default"} × {item.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                      {formatCurrency(item.variant.sellingPrice * item.quantity)}
                    </p>
                  </div>
                );
              })}
            </div>
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
                  {paymentMethod === "KHATA_CREDIT" && selectedKhataId && (
                    <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">· Khata selected</span>
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

                    const activeKhataAccounts = khataAccounts.filter(
                      (a) => a.status === "ACTIVE",
                    );

                    return (
                      <div key={method.value}>
                        <button
                          onClick={() => {
                            setPaymentMethod(method.value);
                            if (!needsKhata) {
                              setSelectedKhataId(null);
                            }
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

                        {/* Khata account selector */}
                        {selected && needsKhata && (
                          <div className="ml-8 mt-2 space-y-1.5">
                            {activeKhataAccounts.length === 0 ? (
                              <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                                No active khata accounts available
                              </p>
                            ) : (
                              activeKhataAccounts.map((khata) => {
                                const khataSelected = selectedKhataId === khata.id;
                                return (
                                  <button
                                    key={khata.id}
                                    onClick={() => setSelectedKhataId(khata.id)}
                                    className={`flex w-full items-center justify-between rounded-lg border p-2.5 text-xs transition-all ${
                                      khataSelected
                                        ? "border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30"
                                        : "border-gray-200 dark:border-gray-700 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 dark:border-gray-600"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <BookOpen size={13} className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
                                      <span>
                                        {khata.farmer?.user.fullName ?? khata.id.slice(0, 8)}
                                      </span>
                                    </div>
                                    <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                                      {formatCurrency(khata.outstandingAmount)} outstanding
                                    </span>
                                  </button>
                                );
                              })
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
                  <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">
                    Subtotal ({items.length} item{items.length !== 1 ? "s" : ""})
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(subtotal)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Discount</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      -{formatCurrency(discountAmount)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Delivery</span>
                  <span
                    className={`font-medium ${
                      deliveryCharge === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-gray-900 dark:text-gray-100 dark:text-gray-100"
                    }`}
                  >
                    {deliveryCharge === 0 ? "Free" : formatCurrency(deliveryCharge)}
                  </span>
                </div>

                {deliveryCharge > 0 && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    Free delivery on orders above ₹500
                  </p>
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
