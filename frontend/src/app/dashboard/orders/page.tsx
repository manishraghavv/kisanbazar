"use client";

import { useEffect, useState, useCallback } from "react";
import { useOrderStore } from "@/stores/orderStore";
import { toast } from "sonner";
import {
  Package,
  ChevronDown,
  ChevronUp,
  XCircle,
  RotateCcw,
  Clock,
  Truck,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import type { OrderStatus, OrderListItem } from "@/types/auth";

// ─── Status config ───────────────────────────────────────────────────────────

const STATUSES: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PROCESSING", label: "Processing" },
  { value: "PACKED", label: "Packed" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "RETURNED", label: "Returned" },
  { value: "REFUNDED", label: "Refunded" },
];

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

// Statuses where the user can cancel
const CANCELLABLE_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED"];
// Statuses where the user can request return
const RETURNABLE_STATUSES: OrderStatus[] = ["DELIVERED"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status];
  if (!style) return <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{status}</span>;
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}
    >
      <Icon size={12} />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Cancel / Return Modal ───────────────────────────────────────────────────

function ActionModal({
  type,
  order,
  onConfirm,
  onCancel,
  isProcessing,
}: {
  type: "cancel" | "return";
  order: OrderListItem;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
}) {
  const [reason, setReason] = useState("");
  const isCancel = type === "cancel";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50">
        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
            isCancel ? "bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30" : "bg-orange-50 dark:bg-orange-900/30 dark:bg-orange-900/30"
          }`}
        >
          {isCancel ? (
            <XCircle size={24} className="text-red-600 dark:text-red-400" />
          ) : (
            <RotateCcw size={24} className="text-orange-600" />
          )}
        </div>
        <h3 className="text-center text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
          {isCancel ? "Cancel Order" : "Request Return"}
        </h3>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">
          {isCancel
            ? "Are you sure you want to cancel this order?"
            : "Request a return for this order"}
        </p>
        <div className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{order.orderNumber}</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {order.items.length} item{order.items.length > 1 ? "s" : ""} ·{" "}
            {formatCurrency(order.totalAmount)}
          </p>
        </div>
        <div className="mt-4">
          <label
            htmlFor="reason"
            className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200"
          >
            Reason <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
            placeholder={
              isCancel
                ? "e.g., Changed my mind, Found better price..."
                : "e.g., Product damaged, Wrong item received..."
            }
          />
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Go Back
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={isProcessing || !reason.trim()}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
              isCancel
                ? "bg-red-600 hover:bg-red-700"
                : "bg-orange-600 hover:bg-orange-700"
            }`}
          >
            {isProcessing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isCancel ? (
              <XCircle size={16} />
            ) : (
              <RotateCcw size={16} />
            )}
            {isCancel ? "Cancel Order" : "Request Return"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order Detail Drawer ─────────────────────────────────────────────────────

function OrderDetailDrawer({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  const { selectedOrder, isOrderLoading, fetchOrderById } = useOrderStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchOrderById(orderId).finally(() => setLoading(false));
  }, [orderId, fetchOrderById]);

  if (loading || isOrderLoading || !selectedOrder) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-end">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative flex h-full w-full max-w-lg flex-col bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/50">
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
          </div>
        </div>
      </div>
    );
  }

  const order = selectedOrder;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 dark:border-gray-700 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{order.orderNumber}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatDate(order.createdAt)}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {/* Status */}
          <div className="flex items-center justify-between">
            <StatusBadge status={order.status} />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
              {formatCurrency(order.totalAmount)}
            </span>
          </div>

          {/* Payment & Shipping meta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Payment
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {order.paymentMethod}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Channel
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {order.channel ?? "Web"}
              </p>
            </div>
            {order.expectedDelivery && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Expected Delivery
                </p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                  {formatDate(order.expectedDelivery)}
                </p>
              </div>
            )}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Items
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {order.items.length} item{order.items.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Items</h3>
            <div className="divide-y divide-gray-100 dark:divide-gray-700 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                      {item.variant.product.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      {item.variant.variantName ?? "Default"} · Qty: {item.quantity} ·{" "}
                      {item.variant.sku}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Price Breakdown */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
              Price Breakdown
            </h3>
            <div className="space-y-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Subtotal</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                  {formatCurrency(order.subtotal)}
                </span>
              </div>
              {order.deliveryCharge > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Delivery</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                    {formatCurrency(order.deliveryCharge)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">GST</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                  {formatCurrency(order.gstAmount)}
                </span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Discount</span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                    -{formatCurrency(order.discountAmount)}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-200 dark:border-gray-700 dark:border-gray-700 pt-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-gray-900 dark:text-gray-100 dark:text-gray-100">Total</span>
                  <span className="text-gray-900 dark:text-gray-100 dark:text-gray-100">
                    {formatCurrency(order.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          {order.address && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                Shipping Address
              </h3>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4">
                {order.address.label && (
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                    {order.address.label}
                  </p>
                )}
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">
                  {order.address.addressLine1}
                  {order.address.addressLine2 && <>, {order.address.addressLine2}</>}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">
                  {[
                    order.address.village,
                    order.address.city,
                    order.address.district,
                    order.address.state,
                  ]
                    .filter(Boolean)
                    .join(", ")}{" "}
                  — {order.address.pincode}
                </p>
              </div>
            </div>
          )}

          {/* Status Timeline */}
          {order.statusHistory && order.statusHistory.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                Status Timeline
              </h3>
              <div className="space-y-0">
                {order.statusHistory.map((entry, idx) => {
                  const style = STATUS_STYLES[entry.newStatus];
                  const Icon = style?.icon ?? Clock;
                  const isLast = idx === 0;
                  return (
                    <div key={entry.id} className="relative flex gap-3 pb-4">
                      {/* Connector line */}
                      {!isLast && (
                        <div className="absolute left-[11px] top-6 h-full w-px bg-gray-200 dark:bg-gray-600 dark:bg-gray-600" />
                      )}
                      {/* Dot */}
                      <div
                        className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          style?.bg ?? "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700"
                        }`}
                      >
                        <Icon
                          size={12}
                          className={style?.text ?? "text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500"}
                        />
                      </div>
                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                          {entry.newStatus.charAt(0) + entry.newStatus.slice(1).toLowerCase()}
                        </p>
                        {entry.remarks && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{entry.remarks}</p>
                        )}
                        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                          {formatDate(entry.changedAt)} · {formatTime(entry.changedAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cancellation reason */}
          {order.cancellationReason && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">
                Cancellation Reason
              </p>
              <p className="mt-1 text-sm text-red-800">{order.cancellationReason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Order Card ──────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onViewDetail,
  onCancel,
  onReturn,
}: {
  order: OrderListItem;
  onViewDetail: () => void;
  onCancel: () => void;
  onReturn: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30">
      {/* Card header */}
      <div className="flex items-start justify-between p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
              {order.orderNumber}
            </h3>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {order.items.length} item{order.items.length > 1 ? "s" : ""} ·{" "}
            {formatDate(order.createdAt)}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            <span>{order.paymentMethod}</span>
            {order._count.shipments > 0 && (
              <span>{order._count.shipments} shipment{order._count.shipments > 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <p className="text-base font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
            {formatCurrency(order.totalAmount)}
          </p>
          <div className="flex gap-1">
            {CANCELLABLE_STATUSES.includes(order.status) && (
              <button
                onClick={onCancel}
                title="Cancel order"
                className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 hover:text-red-600"
              >
                <XCircle size={15} />
              </button>
            )}
            {RETURNABLE_STATUSES.includes(order.status) && (
              <button
                onClick={onReturn}
                title="Request return"
                className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-colors hover:bg-orange-50 dark:bg-orange-900/30 hover:text-orange-600"
              >
                <RotateCcw size={15} />
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300"
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded items preview */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 dark:border-gray-700 px-4 pb-4 pt-3 sm:px-5">
          <div className="divide-y divide-gray-100 dark:divide-gray-700 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                    {item.variant.product.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    {item.variant.variantName ?? "Default"} · Qty: {item.quantity}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={onViewDetail}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50"
          >
            <Eye size={15} />
            View Full Details
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({
  hasFilter,
  onClearFilter,
}: {
  hasFilter: boolean;
  onClearFilter: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 dark:bg-emerald-900/30">
        <Package size={36} className="text-emerald-300" />
      </div>
      <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 dark:text-gray-100">
        {hasFilter ? "No orders match this status" : "No orders yet"}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
        {hasFilter
          ? "Try selecting a different status filter"
          : "Your orders will appear here once you place one"}
      </p>
      {hasFilter && (
        <button
          onClick={onClearFilter}
          className="mt-6 flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50"
        >
          <X size={16} />
          Clear Filter
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const {
    orders,
    total,
    totalPages,
    page,
    isLoading,
    fetchOrders,
    cancelOrder,
    returnOrder,
  } = useOrderStore();

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<{
    type: "cancel" | "return";
    order: OrderListItem;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const loadOrders = useCallback(
    (p: number, s: OrderStatus | "") => {
      fetchOrders(p, 10, s).catch(() => {
        toast.error("Failed to load orders");
      });
    },
    [fetchOrders],
  );

  useEffect(() => {
    loadOrders(currentPage, statusFilter);
  }, [currentPage, statusFilter, loadOrders]);

  const handleFilterChange = (status: OrderStatus | "") => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleCancel = async (reason: string) => {
    if (!actionTarget) return;
    setIsProcessing(true);
    try {
      await cancelOrder(actionTarget.order.id, reason);
      toast.success("Order cancelled successfully");
      setActionTarget(null);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to cancel order");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReturn = async (reason: string) => {
    if (!actionTarget) return;
    setIsProcessing(true);
    try {
      await returnOrder(actionTarget.order.id, reason);
      toast.success("Return request submitted");
      setActionTarget(null);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to request return");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">My Orders</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300 dark:text-gray-300">
          Track and manage your orders
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-1.5 pb-2">
          {STATUSES.map((s) => {
            const active = statusFilter === s.value;
            return (
              <button
                key={s.value}
                onClick={() => handleFilterChange(s.value)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? "bg-emerald-700 text-white shadow-sm dark:shadow-gray-950/30"
                    : "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-200 dark:bg-gray-600"
                }`}
              >
                {s.label}
                {active && total > 0 && (
                  <span className="ml-1.5 opacity-70">({total})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
        </div>
      )}

      {/* Orders list */}
      {!isLoading && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <EmptyState
              hasFilter={statusFilter !== ""}
              onClearFilter={() => handleFilterChange("")}
            />
          ) : (
            <>
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onViewDetail={() => setDetailOrderId(order.id)}
                  onCancel={() => setActionTarget({ type: "cancel", order })}
                  onReturn={() => setActionTarget({ type: "return", order })}
                />
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 px-4 py-3 shadow-sm dark:shadow-gray-950/30">
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    Page {page} of {totalPages} · {total} orders
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const start = Math.max(1, currentPage - 2);
                      const p = start + i;
                      if (p > totalPages) return null;
                      return (
                        <button
                          key={p}
                          onClick={() => handlePageChange(p)}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                            p === currentPage
                              ? "bg-emerald-700 text-white"
                              : "text-gray-600 dark:text-gray-300 dark:text-gray-300 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:hover:bg-gray-700"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Detail Drawer */}
      {detailOrderId && (
        <OrderDetailDrawer
          orderId={detailOrderId}
          onClose={() => setDetailOrderId(null)}
        />
      )}

      {/* Cancel / Return Modal */}
      {actionTarget && (
        <ActionModal
          type={actionTarget.type}
          order={actionTarget.order}
          onConfirm={actionTarget.type === "cancel" ? handleCancel : handleReturn}
          onCancel={() => setActionTarget(null)}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
}
