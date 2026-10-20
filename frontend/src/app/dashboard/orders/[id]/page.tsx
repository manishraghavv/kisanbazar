"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useOrderStore } from "@/stores/orderStore";
import apiClient from "@/lib/api-client";
import { Package, ChevronDown, ChevronUp, XCircle, RotateCcw, Clock, Truck, CheckCircle2, Loader2, ChevronLeft, MapPin, CreditCard, Download, AlertTriangle, ArrowLeft, Calendar, RefreshCw } from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { SubOrdersSection } from "@/components/orders/SubOrdersSection";
import type { OrderDetail, OrderStatus } from "@/types/auth";

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  PENDING: { bg: "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", icon: Clock },
  CONFIRMED: { bg: "bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", icon: CheckCircle2 },
  PROCESSING: { bg: "bg-indigo-50 dark:bg-indigo-900/30 dark:bg-indigo-900/30", text: "text-indigo-800", icon: RefreshCw },
  PACKED: { bg: "bg-purple-50 dark:bg-purple-900/30 dark:bg-purple-900/30", text: "text-purple-800", icon: Package },
  SHIPPED: { bg: "bg-cyan-50 dark:bg-cyan-900/30 dark:bg-cyan-900/30", text: "text-cyan-800", icon: Truck },
  DELIVERED: { bg: "bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300", icon: CheckCircle2 },
  CANCELLED: { bg: "bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30", text: "text-red-800", icon: XCircle },
  RETURNED: { bg: "bg-orange-50 dark:bg-orange-900/30 dark:bg-orange-900/30", text: "text-orange-800", icon: RotateCcw },
  REFUNDED: { bg: "bg-teal-50 dark:bg-teal-900/30 dark:bg-teal-900/30", text: "text-teal-800", icon: RefreshCw },
};

const CANCELLABLE_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const style = STATUS_STYLES[status];
  if (!style) return <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{status.replace(/_/g, " ")}</span>;
  const Icon = style.icon;
  const s = size === "md" ? "px-3.5 py-1 text-xs" : "px-2.5 py-0.5 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${s} ${style.bg} ${style.text}`}>
      <Icon size={size === "md" ? 13 : 11} />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Timeline Component ──────────────────────────────────────────────────────

function StatusTimeline({ entries }: { entries: OrderDetail["statusHistory"] }) {
  if (!entries || entries.length === 0) return null;

  return (
    <div className="space-y-0">
      {[...entries].reverse().map((entry, idx) => {
        const style = STATUS_STYLES[entry.newStatus];
        const Icon = style?.icon ?? Clock;
        const isLast = idx === entries.length - 1;
        return (
          <div key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* Connector line */}
            {!isLast && <div className="absolute left-[11px] top-6 h-full w-0.5 bg-gray-200 dark:bg-gray-600 dark:bg-gray-600" />}
            {/* Dot */}
            <div className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${style?.bg ?? "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700"}`}>
              <Icon size={12} className={style?.text ?? "text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500"} />
            </div>
            {/* Content */}
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {entry.newStatus.charAt(0) + entry.newStatus.slice(1).toLowerCase()}
              </p>
              {entry.remarks && <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">{entry.remarks}</p>}
              <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                {formatDateTime(entry.changedAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Cancel Modal ────────────────────────────────────────────────────────────

function ActionModal({
  type,
  orderNumber,
  onConfirm,
  onCancel,
  isProcessing,
}: {
  type: "cancel";
  orderNumber: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
}) {
  const [reason, setReason] = useState("");
  const isCancel = type === "cancel";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isCancel ? "bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30" : "bg-orange-50 dark:bg-orange-900/30 dark:bg-orange-900/30"}`}>
          {isCancel ? <XCircle size={24} className="text-red-600 dark:text-red-400" /> : <RotateCcw size={24} className="text-orange-600" />}
        </div>
        <h3 className="text-center text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
          {isCancel ? "Cancel Order" : "Request Return"}
        </h3>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">
          {isCancel ? "Are you sure you want to cancel this order?" : "Request a return for this order"}
        </p>
        <div className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3 text-center">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{orderNumber}</p>
        </div>
        <div className="mt-4">
          <label htmlFor="action-reason" className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200">
            Reason <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <textarea
            id="action-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
            placeholder={isCancel ? "e.g., Changed my mind, Found better price..." : "e.g., Product damaged, Wrong item received..."}
          />
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={onCancel} disabled={isProcessing}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-60">
            Go Back
          </button>
          <button onClick={() => onConfirm(reason)} disabled={isProcessing || !reason.trim()}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60 ${isCancel ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"}`}>
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : isCancel ? <XCircle size={16} /> : <RotateCcw size={16} />}
            {isCancel ? "Cancel Order" : "Request Return"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const { selectedOrder, isOrderLoading, fetchOrderById, cancelOrder } = useOrderStore();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action modal
  const [actionType, setActionType] = useState<"cancel" | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await fetchOrderById(orderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setIsLoading(false);
    }
  }, [orderId, fetchOrderById]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadOrder();
  }, [loadOrder]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (selectedOrder) setOrder(selectedOrder);
  }, [selectedOrder]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Cancel handler
  const handleCancel = async (reason: string) => {
    if (!order) return;
    setIsProcessing(true);
    try {
      await cancelOrder(order.id, reason);
      toast.success("Order cancelled");
      setActionType(null);
      await loadOrder();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to cancel order");
    } finally {
      setIsProcessing(false);
    }
  };

  // Loading
  if (isLoading || isOrderLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading order details...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error || !order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30">
            <AlertTriangle size={28} className="text-red-300" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{error ?? "Order not found"}</h2>
          <Link href="/dashboard/orders" className="mt-6 flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50">
            <ChevronLeft size={16} />
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  // Cancelling the order cancels every part (sub-order) that is still PENDING/CONFIRMED.
  const canCancel = (order.subOrders ?? []).some((s) => CANCELLABLE_STATUSES.includes(s.status));

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: "Orders", href: "/dashboard/orders" },
          { label: order.orderNumber },
        ]}
      />

      {/* Header */}
      <div className="mb-6 rounded-2xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
              <Package size={28} className="text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{order.orderNumber}</h1>
                <StatusBadge status={order.status} size="md" />
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Placed on {formatDateTime(order.createdAt)} · {order.items.length} item{order.items.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCancel && (
              <button onClick={() => setActionType("cancel")}
                className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm font-semibold text-red-700 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30">
                <XCircle size={15} />
                Cancel
              </button>
            )}
            <Link href="/dashboard/orders"
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50">
              <ArrowLeft size={15} />
              Back
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left Column ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* One card per seller: items, GST, tracking, invoice, cancel and return */}
          <SubOrdersSection order={order} onChanged={loadOrder} />

          {/* Status Timeline */}
          {order.statusHistory && order.statusHistory.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
              <h3 className="mb-5 text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Status Timeline</h3>
              <StatusTimeline entries={order.statusHistory} />
            </div>
          )}

          {/* Cancellation reason */}
          {order.cancellationReason && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">Cancellation Reason</p>
              <p className="mt-1.5 text-sm text-red-800">{order.cancellationReason}</p>
            </div>
          )}
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-4">
          {/* Payment Info */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Payment</h3>
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-600 dark:bg-gray-600">
                <CreditCard size={16} className="text-gray-600 dark:text-gray-300 dark:text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{order.paymentMethod.replace(/_/g, " ")}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  {order.payments?.length ? `${order.payments.filter(p => p.status === 'SUCCESS').length} payment(s) completed` : "Awaiting payment"}
                </p>
              </div>
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Price Breakdown</h3>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Subtotal</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">GST</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(order.gstAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Delivery</span>
                <span className={`font-medium ${order.deliveryCharge === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-gray-900 dark:text-gray-100 dark:text-gray-100"}`}>
                  {order.deliveryCharge === 0 ? "Free" : formatCurrency(order.deliveryCharge)}
                </span>
              </div>
              {Number(order.cgstAmount ?? 0) > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">CGST</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200">{formatCurrency(Number(order.cgstAmount))}</span>
                </div>
              )}
              {Number(order.sgstAmount ?? 0) > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">SGST</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200">{formatCurrency(Number(order.sgstAmount))}</span>
                </div>
              )}
              {Number(order.igstAmount ?? 0) > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">IGST</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200">{formatCurrency(Number(order.igstAmount))}</span>
                </div>
              )}
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Discount</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">-{formatCurrency(order.discountAmount)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 dark:border-gray-700 dark:border-gray-700 pt-2.5">
                <div className="flex justify-between text-base font-bold">
                  <span className="text-gray-900 dark:text-gray-100 dark:text-gray-100">Total</span>
                  <span className="text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(order.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          {order.address && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={14} className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Shipping Address</h3>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3">
                {order.address.label && <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{order.address.label}</p>}
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">
                  {order.address.addressLine1}
                  {order.address.addressLine2 && <>, {order.address.addressLine2}</>}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">
                  {[order.address.village, order.address.city, order.address.district, order.address.state].filter(Boolean).join(", ")} — {order.address.pincode}
                </p>
              </div>
            </div>
          )}

          {/* Order Meta */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Order Info</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Channel</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{order.channel ?? "Web"}</span>
              </div>
              {order.couponCode && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Coupon</span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">{order.couponCode}</span>
                </div>
              )}
              {order.paymentMethod === "KHATA_CREDIT" && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Khata Account</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">Linked</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Items</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{order.items.length}</span>
              </div>
            </div>
          </div>

          {/* Expected delivery */}
          {order.expectedDelivery && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
              <div className="flex items-center gap-2 text-sm">
                <Truck size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Expected delivery:</span>
                <span className="font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatDate(order.expectedDelivery)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      {actionType && (
        <ActionModal
          type={actionType}
          orderNumber={order.orderNumber}
          onConfirm={handleCancel}
          onCancel={() => setActionType(null)}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
}
