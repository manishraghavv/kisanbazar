"use client";

import { useEffect, useState, useCallback } from "react";
import { usePaymentStore } from "@/stores/paymentStore";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import {
  CreditCard,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  RefreshCw,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  Ban,
  Receipt,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import type { PaymentListItem } from "@/types/auth";

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "SUCCESS", label: "Success" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "PARTIALLY_REFUNDED", label: "Partial Refund" },
];

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  SUCCESS: { bg: "bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300", icon: CheckCircle2 },
  PENDING: { bg: "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", icon: Clock },
  FAILED: { bg: "bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30", text: "text-red-800", icon: XCircle },
  REFUNDED: { bg: "bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", icon: RotateCcw },
  PARTIALLY_REFUNDED: { bg: "bg-purple-50 dark:bg-purple-900/30 dark:bg-purple-900/30", text: "text-purple-800", icon: RefreshCw },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMethodLabel(method: string) {
  const labels: Record<string, string> = {
    COD: "Cash on Delivery",
    UPI: "UPI",
    CARD: "Card",
    NET_BANKING: "Net Banking",
    WALLET: "Wallet",
  };
  return labels[method] ?? method;
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { bg: "bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50", text: "text-gray-700 dark:text-gray-200 dark:text-gray-200", icon: Ban };
  const Icon = style.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.bg} ${style.text}`}
    >
      <Icon size={11} />
      {status === "PARTIALLY_REFUNDED" ? "Partial Refund" : status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Payment Card ─────────────────────────────────────────────────────────────

function PaymentCard({
  payment,
  onViewDetail,
}: {
  payment: PaymentListItem;
  onViewDetail: () => void;
}) {
  const isSuccess = payment.status === "SUCCESS";
  const isFailed = payment.status === "FAILED";

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              isSuccess ? "bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30" : isFailed ? "bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30" : "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30"
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
            ) : isFailed ? (
              <XCircle size={20} className="text-red-600 dark:text-red-400" />
            ) : (
              <Clock size={20} className="text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
              {formatCurrency(payment.amount)}
            </p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              {getMethodLabel(payment.paymentMethod)}
              {payment.gateway && ` via ${payment.gateway}`}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              {formatDate(payment.createdAt)}
            </p>
          </div>
        </div>
        <StatusBadge status={payment.status} />
      </div>

      {payment.order?.orderNumber && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
          <Receipt size={12} />
          Order:{" "}
          <Link
            href={`/dashboard/orders`}
            className="font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline"
          >
            {payment.order.orderNumber}
          </Link>
        </div>
      )}

      {payment.transactionId && (
        <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
          TXN: {payment.transactionId}
        </p>
      )}

      <button
        onClick={onViewDetail}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400"
      >
        <Eye size={13} />
        View Details
      </button>
    </div>
  );
}

// ─── Payment Detail Drawer ───────────────────────────────────────────────────

function PaymentDetailDrawer({
  paymentId,
  onClose,
}: {
  paymentId: string;
  onClose: () => void;
}) {
  const { selectedPayment, isPaymentLoading, getPaymentById } = usePaymentStore();
  const [loading, setLoading] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLoading(true);
    getPaymentById(paymentId).finally(() => setLoading(false));
  }, [paymentId, getPaymentById]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (loading || isPaymentLoading || !selectedPayment) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-end">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative flex h-full w-full max-w-lg flex-col bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/50">
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
          </div>
        </div>
      </div>
    );
  }

  const p = selectedPayment;
  const style = STATUS_STYLES[p.status] ?? { bg: "bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50", text: "text-gray-700 dark:text-gray-200 dark:text-gray-200", icon: Ban };
  const StatusIcon = style.icon;
  const isSuccess = p.status === "SUCCESS";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 dark:border-gray-700 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Payment Details</h2>
            <span
              className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.bg} ${style.text}`}
            >
              <StatusIcon size={11} />
              {p.status === "PARTIALLY_REFUNDED" ? "Partial Refund" : p.status.charAt(0) + p.status.slice(1).toLowerCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {/* Amount Card */}
          <div
            className={`rounded-xl p-5 ${
              isSuccess
                ? "bg-gradient-to-r from-emerald-700 to-emerald-600 text-white"
                : "bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50"
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wider opacity-80">Amount</p>
            <p className={`mt-1 text-2xl font-bold ${!isSuccess ? "text-gray-900 dark:text-gray-100 dark:text-gray-100" : ""}`}>
              {formatCurrency(p.amount)}
            </p>
            <p className={`mt-0.5 text-xs opacity-80`}>
              {p.currency || "INR"}
            </p>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Method
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {getMethodLabel(p.paymentMethod)}
              </p>
            </div>
            {p.gateway && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Gateway
                </p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{p.gateway}</p>
              </div>
            )}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Status
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {p.status === "PARTIALLY_REFUNDED" ? "Partially Refunded" : p.status.charAt(0) + p.status.slice(1).toLowerCase()}
              </p>
            </div>
            {p.paidAt && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Paid At
                </p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                  {formatDateTime(p.paidAt)}
                </p>
              </div>
            )}
          </div>

          {/* Transaction ID */}
          {p.transactionId && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Transaction ID</h3>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5">
                <p className="font-mono text-sm text-gray-700 dark:text-gray-200 dark:text-gray-200 break-all">{p.transactionId}</p>
              </div>
            </div>
          )}

          {/* Order Link */}
          {p.order?.orderNumber && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Related Order</h3>
              <Link
                href={`/dashboard/orders`}
                className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-400 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 hover:border-emerald-200 dark:hover:border-emerald-700"
              >
                <Receipt size={14} />
                {p.order.orderNumber}
                <ArrowRight size={14} className="ml-auto" />
              </Link>
            </div>
          )}

          {/* Created At */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Timeline</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5">
                <span className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">Created</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                  {formatDateTime(p.createdAt)}
                </span>
              </div>
              {p.paidAt && (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 px-4 py-2.5">
                  <span className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 size={14} />
                    Paid
                  </span>
                  <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    {formatDateTime(p.paidAt)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({
  hasFilter,
  onClear,
}: {
  hasFilter: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30">
        <CreditCard size={36} className="text-emerald-300" />
      </div>
      <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
        {hasFilter ? "No payments match this filter" : "No payments yet"}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
        {hasFilter
          ? "Try selecting a different status filter"
          : "Your payment history will appear here once you place orders"}
      </p>
      {hasFilter && (
        <button
          onClick={onClear}
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

export default function PaymentsPage() {
  const { payments, total, page, totalPages, isLoading, getPayments } =
    usePaymentStore();
  const { user } = useAuthStore();

  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  const loadPayments = useCallback(
    (p: number, status: string) => {
      getPayments(p, 20, status || undefined).catch(() => toast.error("Failed to load payments"));
    },
    [getPayments],
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadPayments(currentPage, statusFilter);
  }, [currentPage, statusFilter, loadPayments]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handlePageChange = (p: number) => {
    if (p < 1) return;
    setCurrentPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPagesNum = Math.ceil(total / 20);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Payments</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
          {user?.role === "VENDOR"
            ? "Payment history and settlement records"
            : "Your payment history across all orders"}
        </p>
      </div>

      {/* Status Filter Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setCurrentPage(1);
            }}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === tab.value
                ? "bg-emerald-700 text-white shadow-sm dark:shadow-gray-950/30"
                : "bg-white dark:bg-gray-800 dark:bg-gray-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 border border-gray-200 dark:border-gray-700 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 dark:border-gray-600 hover:text-gray-800 dark:text-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
        </div>
      ) : payments.length === 0 ? (
        <EmptyState
          hasFilter={!!statusFilter}
          onClear={() => setStatusFilter("")}
        />
      ) : (
        <>
          {/* Result count */}
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {total} payment{total !== 1 ? "s" : ""}
            {statusFilter ? ` · ${STATUS_TABS.find((t) => t.value === statusFilter)?.label ?? statusFilter}` : ""}
          </p>

          {/* Payment Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {payments.map((payment) => (
              <PaymentCard
                key={payment.id}
                payment={payment}
                onViewDetail={() => setSelectedPaymentId(payment.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPagesNum > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(totalPagesNum, 5) }, (_, i) => {
                const start = Math.max(1, Math.min(currentPage - 2, totalPagesNum - 4));
                const p = start + i;
                if (p > totalPagesNum) return null;
                return (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                      p === currentPage
                        ? "bg-emerald-700 text-white"
                        : "text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPagesNum}
                className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail Drawer */}
      {selectedPaymentId && (
        <PaymentDetailDrawer
          paymentId={selectedPaymentId}
          onClose={() => {
            setSelectedPaymentId(null);
          }}
        />
      )}
    </div>
  );
}
