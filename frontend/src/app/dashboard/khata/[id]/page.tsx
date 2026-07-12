"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useKhataStore } from "@/stores/khataStore";
import { useAuthStore } from "@/stores/authStore";
import apiClient from "@/lib/api-client";
import {
  BookOpen,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  Ban,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CalendarDays,
  Plus,
  Send,
  Download,
  X,
  User,
  Building2,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  PenSquare,
  Save,
} from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import type {
  KhataAccount,
  KhataTransaction,
  KhataRequest,
  KhataAccountStatus,
  KhataTransactionType,
} from "@/types/auth";

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  ACTIVE: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300 dark:text-emerald-400", icon: CheckCircle2 },
  SETTLED: { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", icon: CheckCircle2 },
  OVERDUE: { bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-800 dark:text-red-300 dark:text-red-400", icon: AlertTriangle },
  SUSPENDED: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", icon: Ban },
  WRITTEN_OFF: { bg: "bg-gray-50 dark:bg-gray-700/50", text: "text-gray-800 dark:text-gray-200", icon: Ban },
};

const TXN_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  UDHAR_DIYA: { label: "Credit Given", color: "text-red-600 dark:text-red-400" },
  WAPSI_MILI: { label: "Repayment", color: "text-emerald-600 dark:text-emerald-400" },
  INTEREST_LAGA: { label: "Interest Charged", color: "text-amber-600 dark:text-amber-400" },
  WAIVER: { label: "Waiver", color: "text-blue-600 dark:text-blue-400" },
  ORDER_LINKED: { label: "Order Linked", color: "text-purple-600" },
};

const REQUEST_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300" },
  APPROVED: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300 dark:text-emerald-400" },
  REJECTED: { bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-800 dark:text-red-300 dark:text-red-400" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status];
  if (!style) return <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{status}</span>;
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}>
      <Icon size={12} />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Transactions List ────────────────────────────────────────────────────────

function TransactionList({
  transactions,
  loading,
}: {
  transactions: KhataTransaction[];
  loading: boolean;
}) {
  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-emerald-700 dark:text-emerald-400" /></div>;
  }
  if (transactions.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500 italic">No transactions yet</div>;
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {transactions.map((tx) => {
        const txnInfo = TXN_TYPE_LABELS[tx.type] ?? { label: tx.type, color: "text-gray-600 dark:text-gray-300 dark:text-gray-500" };
        const isDebit = ["UDHAR_DIYA", "INTEREST_LAGA", "ORDER_LINKED"].includes(tx.type);
        return (
          <div key={tx.id} className="flex items-start justify-between px-4 py-3.5 hover:bg-gray-50/50 transition-colors">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isDebit ? "bg-red-50 dark:bg-red-900/30" : "bg-emerald-50 dark:bg-emerald-900/30"}`}>
                {isDebit ? <ArrowUpRight size={14} className="text-red-600 dark:text-red-400" /> : <ArrowDownLeft size={14} className="text-emerald-600 dark:text-emerald-400" />}
              </div>
              <div>
                <p className={`text-sm font-medium ${txnInfo.color}`}>{txnInfo.label}</p>
                {tx.remarks && <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{tx.remarks}</p>}
                {tx.upiTransactionId && <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">UPI: {tx.upiTransactionId}</p>}
                <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{formatDateTime(tx.createdAt)}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-sm font-bold ${isDebit ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {isDebit ? "+" : "-"}{formatCurrency(tx.amount)}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">Bal: {formatCurrency(tx.balanceAfter)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Statements List ──────────────────────────────────────────────────────────

function StatementList({
  accountId,
  statements,
  loading,
  onRefresh,
}: {
  accountId: string;
  statements: any[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      await apiClient.post(`/khata/accounts/${accountId}/statement/generate`, {
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      });
      toast.success("Statement generated");
      onRefresh();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to generate statement");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const res = await apiClient.get(`/khata/accounts/${accountId}/statement/pdf`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `khata-statement-${accountId.slice(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Statement PDF downloaded");
    } catch {
      toast.error("Failed to download statement");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-emerald-700 dark:text-emerald-400" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
          {statements.length > 0 ? `${statements.length} statement(s)` : "No statements generated yet"}
        </p>
        <div className="flex gap-2">
          <button onClick={handleDownloadPdf}
            className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <Download size={12} /> PDF
          </button>
          <button onClick={handleGenerate} disabled={isGenerating}
            className="flex items-center gap-1 rounded-lg bg-emerald-700 dark:bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors">
            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Generate
          </button>
        </div>
      </div>

      {statements.length > 0 && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
          {statements.map((stmt: any) => (
            <div key={stmt.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatDate(stmt.periodStart)} — {formatDate(stmt.periodEnd)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Opening: {formatCurrency(stmt.openingBalance)} · Closing: {formatCurrency(stmt.closingBalance)}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">Debits: {formatCurrency(stmt.totalDebits)}</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Credits: {formatCurrency(stmt.totalCredits)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add Transaction Form ─────────────────────────────────────────────────────

function AddTransactionForm({
  accountId,
  onCreated,
  onCancel,
}: {
  accountId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<KhataTransactionType>("WAPSI_MILI");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [upiTransactionId, setUpiTransactionId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { setError("Amount must be positive"); return; }
    setIsSaving(true);
    setError("");
    try {
      await apiClient.post(`/khata/accounts/${accountId}/transactions`, {
        type,
        amount: Number(amount),
        remarks: remarks.trim() || undefined,
        upiTransactionId: upiTransactionId.trim() || undefined,
      });
      toast.success("Transaction recorded");
      onCreated();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message ?? "Failed to record transaction");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30 space-y-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Record Transaction</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">Type *</label>
          <select value={type} onChange={(e) => setType(e.target.value as KhataTransactionType)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400">
            <option value="WAPSI_MILI">Repayment (Credit)</option>
            <option value="UDHAR_DIYA">Credit Given (Debit)</option>
            <option value="INTEREST_LAGA">Interest Charged</option>
            <option value="WAIVER">Waiver</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">Amount *</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">₹</span>
            <input type="number" step="0.01" min="0.01" value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(""); }}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 pl-8 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">UPI Transaction ID</label>
          <input value={upiTransactionId} onChange={(e) => setUpiTransactionId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 font-mono"
            placeholder="Optional" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">Remarks</label>
          <input value={remarks} onChange={(e) => setRemarks(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400"
            placeholder="Optional" />
        </div>
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      <div className="flex items-center justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">Cancel</button>
        <button type="submit" disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-emerald-700 dark:bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow dark:shadow-gray-950/20 hover:bg-emerald-800 disabled:opacity-50 transition-all">
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {isSaving ? "Recording..." : "Record Transaction"}
        </button>
      </div>
    </form>
  );
}

// ─── Edit Terms Form (Vendor/Admin) ──────────────────────────────────────────

function EditTermsForm({
  account,
  onUpdated,
  onCancel,
}: {
  account: any;
  onUpdated: () => void;
  onCancel: () => void;
}) {
  const [creditLimitAmount, setCreditLimitAmount] = useState(String(account.creditLimitAmount));
  const [interestRatePct, setInterestRatePct] = useState(String(account.interestRatePct));
  const [creditPeriodDays, setCreditPeriodDays] = useState(String(account.creditPeriodDays));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = Number(creditLimitAmount);
    if (!creditLimitAmount || limit <= 0) { setError("Credit limit must be positive"); return; }
    const days = Number(creditPeriodDays);
    if (days < 1 || days > 365) { setError("Credit period must be 1–365 days"); return; }

    setIsSaving(true);
    setError("");
    try {
      await apiClient.put(`/khata/accounts/${account.id}`, {
        creditLimitAmount: limit,
        interestRatePct: Number(interestRatePct) || 0,
        creditPeriodDays: days,
      });
      toast.success("Account terms updated");
      onUpdated();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message ?? "Failed to update terms");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 p-4 space-y-3">
      <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 dark:text-emerald-400 uppercase tracking-wider">Edit Account Terms</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">Credit Limit *</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 dark:text-gray-500">₹</span>
            <input type="number" step="1" min="1" value={creditLimitAmount}
              onChange={(e) => { setCreditLimitAmount(e.target.value); setError(""); }}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-2.5 py-2 pl-6 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">Interest Rate</label>
          <div className="relative">
            <input type="number" step="0.1" min="0" max="100" value={interestRatePct}
              onChange={(e) => setInterestRatePct(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-2.5 py-2 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20" />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 dark:text-gray-500">%</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">Credit Period</label>
          <div className="relative">
            <input type="number" step="1" min="1" max="365" value={creditPeriodDays}
              onChange={(e) => setCreditPeriodDays(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-2.5 py-2 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20" />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 dark:text-gray-500">days</span>
          </div>
        </div>
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">Cancel</button>
        <button type="submit" disabled={isSaving}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-700 dark:bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow dark:shadow-gray-950/20 hover:bg-emerald-800 disabled:opacity-50 transition-all">
          {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

// ─── Credit Request Form (Farmer) ─────────────────────────────────────────────

function CreditRequestForm({
  account,
  onCreated,
  onCancel,
}: {
  account: KhataAccount;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [requestedLimit, setRequestedLimit] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedLimit || Number(requestedLimit) <= account.creditLimitAmount) {
      setError(`Requested limit must be greater than current limit (${formatCurrency(account.creditLimitAmount)})`);
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await apiClient.post(`/khata/accounts/${account.id}/requests`, {
        requestedLimit: Number(requestedLimit),
        reason: reason.trim() || undefined,
      });
      toast.success("Credit limit request submitted");
      onCreated();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message ?? "Failed to submit request");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30 space-y-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Request Credit Limit Increase</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Current limit: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(account.creditLimitAmount)}</span></p>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">New Requested Limit *</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">₹</span>
          <input type="number" step="1" min={account.creditLimitAmount + 1} value={requestedLimit}
            onChange={(e) => { setRequestedLimit(e.target.value); setError(""); }}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 pl-8 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20" />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">Reason</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 resize-none"
          placeholder="Why do you need a higher limit?" />
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">Cancel</button>
        <button type="submit" disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-emerald-700 dark:bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow dark:shadow-gray-950/20 hover:bg-emerald-800 disabled:opacity-50 transition-all">
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Submit Request
        </button>
      </div>
    </form>
  );
}

// ─── Review Credit Request (Vendor) ───────────────────────────────────────────

function PendingCreditRequests({
  account,
  requests,
  onRefresh,
}: {
  account: KhataAccount;
  requests: KhataRequest[];
  onRefresh: () => void;
}) {
  const [reviewing, setReviewing] = useState<string | null>(null);

  const handleReview = async (requestId: string, status: "APPROVED" | "REJECTED") => {
    setReviewing(requestId);
    try {
      await apiClient.put(`/khata/requests/${requestId}`, { status });
      toast.success(`Request ${status.toLowerCase()}`);
      onRefresh();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? `Failed to ${status.toLowerCase()} request`);
    } finally {
      setReviewing(null);
    }
  };

  const pending = requests.filter((r) => r.status === "PENDING");
  const reviewed = requests.filter((r) => r.status !== "PENDING");

  return (
    <div>
      {pending.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending Requests</p>
          {pending.map((req) => (
            <div key={req.id} className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 p-4 mb-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Request: {formatCurrency(req.requestedLimit)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Current limit: {formatCurrency(req.currentLimit)}</p>
                  {req.reason && <p className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-500 mt-0.5">Reason: {req.reason}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleReview(req.id, "APPROVED")} disabled={reviewing === req.id}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 dark:bg-emerald-700 dark:bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 dark:bg-emerald-600 disabled:opacity-50 transition-colors">
                  {reviewing === req.id ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />}
                  Approve
                </button>
                <button onClick={() => handleReview(req.id, "REJECTED")} disabled={reviewing === req.id}
                  className="flex items-center gap-1 rounded-lg bg-red-500 dark:bg-red-600 dark:bg-red-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-600 dark:bg-red-700 disabled:opacity-50 transition-colors">
                  {reviewing === req.id ? <Loader2 size={12} className="animate-spin" /> : <ThumbsDown size={12} />}
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">History</p>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
            {reviewed.map((req) => (
              <div key={req.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatCurrency(req.requestedLimit)}</p>
                  {req.reason && <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{req.reason}</p>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${REQUEST_STATUS_STYLES[req.status]?.bg} ${REQUEST_STATUS_STYLES[req.status]?.text}`}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && reviewed.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">No credit requests</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KhataDetailPage() {
  const params = useParams();
  const { user } = useAuthStore();
  const accountId = params.id as string;

  const { selectedAccount, isAccountLoading } = useKhataStore();
  const [account, setAccount] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transactions
  const [transactions, setTransactions] = useState<KhataTransaction[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(0);
  const [txTotal, setTxTotal] = useState(0);
  const [txLoading, setTxLoading] = useState(false);

  // Statements
  const [statements, setStatements] = useState<any[]>([]);
  const [stmtsLoading, setStmtsLoading] = useState(false);

  // Requests
  const [requests, setRequests] = useState<KhataRequest[]>([]);

  // UI state
  const [showAddTx, setShowAddTx] = useState(false);
  const [showCreditRequest, setShowCreditRequest] = useState(false);
  const [showEditTerms, setShowEditTerms] = useState(false);

  const loadAccount = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: any }>(`/khata/accounts/${accountId}`);
      setAccount(res.data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load account");
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  const loadTransactions = useCallback(async (page: number) => {
    setTxLoading(true);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: { transactions: KhataTransaction[]; total: number; page: number; totalPages: number };
      }>(`/khata/accounts/${accountId}/transactions`, { params: { page, limit: 15 } });
      setTransactions(res.data.data.transactions);
      setTxTotal(res.data.data.total);
      setTxPage(res.data.data.page);
      setTxTotalPages(res.data.data.totalPages);
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setTxLoading(false);
    }
  }, [accountId]);

  const loadStatements = useCallback(async () => {
    setStmtsLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: any[] }>(`/khata/accounts/${accountId}/statements`);
      setStatements(res.data.data);
    } catch {
      // Silently fail
    } finally {
      setStmtsLoading(false);
    }
  }, [accountId]);

  const loadRequestsList = useCallback(async () => {
    try {
      const res = await apiClient.get<{ success: boolean; data: { requests: KhataRequest[]; total: number; totalPages: number } }>(
        `/khata/accounts/${accountId}/requests`,
        { params: { page: 1, limit: 20 } }
      );
      setRequests(res.data.data.requests);
    } catch { /* silently fail */ }
  }, [accountId]);

  // Initial load
  useEffect(() => {
    loadAccount();
    loadTransactions(1);
    loadStatements();
    loadRequestsList();
  }, [loadAccount, loadTransactions, loadStatements, loadRequestsList]);

  const refreshAll = () => {
    loadAccount();
    loadTransactions(txPage);
    loadStatements();
    loadRequestsList();
  };

  const isVendor = user?.role === "VENDOR";
  const isFarmer = user?.role === "FARMER";
  const isAdmin = user?.role === "ADMIN";

  // Loading
  if (isLoading || isAccountLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading account details...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error || !account) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/30">
            <AlertTriangle size={28} className="text-red-300 dark:text-red-400" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100">{error ?? "Account not found"}</h2>
          <Link href="/dashboard/khata" className="mt-6 flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <ChevronLeft size={16} />
            Back to KhataBook
          </Link>
        </div>
      </div>
    );
  }

  const style = STATUS_STYLES[account.status] ?? STATUS_STYLES.ACTIVE;
  const StatusIcon = style.icon;
  const available = Math.max(0, account.creditLimitAmount - account.outstandingAmount);

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: "KhataBook", href: "/dashboard/khata" },
          { label: account.vendor?.businessName || account.farmer?.user.fullName || "Account" },
        ]}
      />

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
            <BookOpen size={24} className="text-emerald-700 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {account.vendor?.businessName || account.farmer?.user.fullName || "Khata Account"}
              </h1>
              <StatusBadge status={account.status} />
            </div>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
              {account.farmer?.user.fullName ? `Farmer: ${account.farmer.user.fullName} · ${account.farmer.user.phoneNumber}` : ""}
              {account.vendor?.businessName ? `Vendor: ${account.vendor.businessName}` : ""}
            </p>
          </div>
        </div>
        <Link href="/dashboard/khata" className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <ChevronLeft size={16} />
          Back
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left Column ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Balance Card */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500 p-6 text-white shadow-lg dark:shadow-gray-950/30">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-100 dark:text-emerald-200">Outstanding Balance</p>
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${style.bg} ${style.text}`}>
                <StatusIcon size={10} />
                {account.status}
              </span>
            </div>
            <p className="text-3xl font-bold">{formatCurrency(account.outstandingAmount)}</p>
            <div className="mt-5 grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-emerald-100 dark:text-emerald-200 uppercase tracking-wider">Credit Limit</p>
                <p className="text-base font-bold">{formatCurrency(account.creditLimitAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-emerald-100 dark:text-emerald-200 uppercase tracking-wider">Available</p>
                <p className="text-base font-bold">{formatCurrency(available)}</p>
              </div>
              <div>
                <p className="text-[10px] text-emerald-100 dark:text-emerald-200 uppercase tracking-wider">Interest</p>
                <p className="text-base font-bold">{account.interestRatePct}%</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-emerald-100 dark:text-emerald-200">
              <span className="flex items-center gap-1"><CalendarDays size={12} />Period: {account.creditPeriodDays}d</span>
              {account.dueDateNextPayment && (
                <span className="flex items-center gap-1"><AlertCircle size={12} />Due: {formatDate(account.dueDateNextPayment)}</span>
              )}
            </div>
          </div>

          {/* Transactions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Transactions ({txTotal})</h3>
              {(isVendor || isAdmin) && (
                <button onClick={() => setShowAddTx(!showAddTx)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-700 dark:bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition-colors">
                  {showAddTx ? <X size={13} /> : <Plus size={13} />}
                  {showAddTx ? "Cancel" : "Add Transaction"}
                </button>
              )}
            </div>

            {showAddTx && (
              <div className="mb-4">
                <AddTransactionForm accountId={account.id} onCreated={() => { setShowAddTx(false); refreshAll(); }} onCancel={() => setShowAddTx(false)} />
              </div>
            )}

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30">
              <TransactionList transactions={transactions} loading={txLoading} />
            </div>

            {txTotalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Page {txPage} of {txTotalPages}</p>
                <div className="flex gap-1">
                  <button onClick={() => loadTransactions(txPage - 1)} disabled={txPage <= 1}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 p-1.5 text-gray-600 dark:text-gray-300 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-40 transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  <button onClick={() => loadTransactions(txPage + 1)} disabled={txPage >= txTotalPages}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 p-1.5 text-gray-600 dark:text-gray-300 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-40 transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-4">
          {/* Account Info */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Account Info</h3>
              {(isVendor || isAdmin) && (
                <button onClick={() => setShowEditTerms(!showEditTerms)}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  {showEditTerms ? <X size={12} /> : <PenSquare size={12} />}
                  {showEditTerms ? "Cancel" : "Edit Terms"}
                </button>
              )}
            </div>

            {showEditTerms && (
              <EditTermsForm account={account} onUpdated={() => { setShowEditTerms(false); refreshAll(); }} onCancel={() => setShowEditTerms(false)} />
            )}

            <div className="space-y-2.5">
              {account.vendor && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 size={14} className="text-gray-400 dark:text-gray-500" />
                  <span className="text-gray-600 dark:text-gray-300 dark:text-gray-500">Vendor:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{account.vendor.businessName}</span>
                </div>
              )}
              {account.farmer && (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <User size={14} className="text-gray-400 dark:text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-300 dark:text-gray-500">Farmer:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{account.farmer.user.fullName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 dark:text-gray-500 ml-1">📞</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{account.farmer.user.phoneNumber}</span>
                  </div>
                </>
              )}
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays size={14} className="text-gray-400 dark:text-gray-500" />
                <span className="text-gray-600 dark:text-gray-300 dark:text-gray-500">Created:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatDate(account.createdAt)}</span>
              </div>
              {account.lastTransactionAt && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={14} className="text-gray-400 dark:text-gray-500" />
                  <span className="text-gray-600 dark:text-gray-300 dark:text-gray-500">Last Activity:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{formatDate(account.lastTransactionAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Credit Requests */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Credit Requests</h3>
              {isFarmer && (
                <button onClick={() => setShowCreditRequest(!showCreditRequest)}
                  className="flex items-center gap-1 rounded-lg bg-emerald-700 dark:bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition-colors">
                  {showCreditRequest ? <X size={12} /> : <Plus size={12} />}
                  {showCreditRequest ? "Cancel" : "Request"}
                </button>
              )}
            </div>

            {showCreditRequest && (
              <div className="mb-4">
                <CreditRequestForm account={account} onCreated={() => { setShowCreditRequest(false); refreshAll(); }} onCancel={() => setShowCreditRequest(false)} />
              </div>
            )}

            <PendingCreditRequests account={account} requests={requests} onRefresh={refreshAll} />
          </div>

          {/* Statements */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">Statements</h3>
            <StatementList accountId={account.id} statements={statements} loading={stmtsLoading} onRefresh={loadStatements} />
          </div>
        </div>
      </div>
    </div>
  );
}
