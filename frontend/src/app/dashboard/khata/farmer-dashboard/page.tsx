"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import {
  BookOpen,
  Loader2,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  IndianRupee,
  Bell,
  CalendarDays,
  AlertCircle,
  ChevronRight,
  Eye,
  Plus,
  Send,
  X,
  Ban,
  Landmark,
  Download,
} from "lucide-react";
import type { KhataAccount, KhataTransaction, KhataAccountStatus } from "@/types/auth";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AccountWithVendor extends KhataAccount {
  vendor?: { businessName: string };
  farmer?: { user: { fullName: string; phoneNumber: string } };
}

interface DueItem {
  accountId: string;
  vendorName: string;
  outstandingAmount: number;
  dueDate: string | null;
  daysRemaining: number;
  status: KhataAccountStatus;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatCompact(num: number) {
  if (num >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateShort(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  trend?: { up: boolean; value: string };
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {sublabel && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{sublabel}</p>}
          {trend && (
            <p className={`mt-1 flex items-center gap-0.5 text-xs font-semibold ${trend.up ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {trend.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trend.value}
            </p>
          )}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Account Card (Farmer View) ──────────────────────────────────────────────

function AccountCard({ account }: { account: AccountWithVendor }) {
  const isOverdue = account.status === "OVERDUE";
  const isSettled = account.status === "SETTLED";
  const progressPct = account.creditLimitAmount > 0
    ? Math.min(100, (account.outstandingAmount / account.creditLimitAmount) * 100)
    : 0;

  return (
    <div className={`rounded-xl border p-5 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30 ${
      isOverdue ? "border-red-200 dark:border-red-800 bg-white dark:bg-gray-800" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            isOverdue ? "bg-red-50 dark:bg-red-900/30" : isSettled ? "bg-blue-50 dark:bg-blue-900/30" : "bg-emerald-50 dark:bg-emerald-900/30"
          }`}>
            <Landmark size={20} className={isOverdue ? "text-red-600 dark:text-red-400" : isSettled ? "text-blue-600 dark:text-blue-400" : "text-emerald-700 dark:text-emerald-400"} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{account.vendor?.businessName ?? "Vendor"}</p>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
              {isOverdue ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-900/30 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-400">
                  <AlertTriangle size={10} /> Overdue
                </span>
              ) : isSettled ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                  <CheckCircle2 size={10} /> Settled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 size={10} /> Active
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Outstanding</p>
          <p className={`text-lg font-bold ${isOverdue ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100"}`}>
            {formatCurrency(account.outstandingAmount)}
          </p>
        </div>
      </div>

      {/* Usage bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500">Credit utilization</span>
          <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300 dark:text-gray-500">{progressPct.toFixed(0)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
          <div
            className={`h-full rounded-full transition-all ${
              progressPct > 90 ? "bg-red-500 dark:bg-red-600 dark:bg-red-700" : progressPct > 70 ? "bg-amber-500" : "bg-emerald-500 dark:bg-emerald-600"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Info grid */}
      <div className="mb-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Limit</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCompact(account.creditLimitAmount)}</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Available</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {formatCompact(Math.max(0, account.creditLimitAmount - account.outstandingAmount))}
          </p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Interest</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{account.interestRatePct}%</p>
        </div>
      </div>

      {/* Due date reminder */}
      {account.dueDateNextPayment && !isSettled && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg px-3 py-2 ${
          isOverdue ? "bg-red-50 dark:bg-red-900/30" : "bg-amber-50 dark:bg-amber-900/30"
        }`}>
          <Bell size={14} className={isOverdue ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"} />
          <p className={`text-xs font-medium ${isOverdue ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
            {isOverdue
              ? `Overdue since ${formatDateShort(account.dueDateNextPayment)}`
              : `Due on ${formatDate(account.dueDateNextPayment)}`}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          href={`/dashboard/khata/${account.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
        >
          <Eye size={13} />
          View Details
        </Link>
        {!isSettled && (
          <Link
            href={`/dashboard/khata/${account.id}`}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 dark:bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition-colors"
          >
            <IndianRupee size={13} />
            Pay Now
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Due Date Reminder Card ──────────────────────────────────────────────────

function DueReminderSection({ dues, loading }: { dues: DueItem[]; loading: boolean }) {
  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-emerald-700 dark:text-emerald-400" /></div>;
  }

  const overdue = dues.filter(d => d.status === "OVERDUE" || d.daysRemaining < 0);
  const upcoming = dues.filter(d => d.status !== "OVERDUE" && d.daysRemaining >= 0 && d.daysRemaining <= 7);
  const later = dues.filter(d => d.status !== "OVERDUE" && d.daysRemaining > 7);

  if (dues.length === 0) {
    return (
      <div className="flex flex-col items-center py-8">
        <CheckCircle2 size={28} className="text-emerald-400" />
        <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-300 dark:text-gray-500">No upcoming dues</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">All your accounts are in good standing</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Overdue */}
      {overdue.map(d => (
        <Link key={d.accountId} href={`/dashboard/khata/${d.accountId}`}
          className="flex items-center justify-between rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20 px-4 py-3 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20">
          <div className="flex items-center gap-3">
            <AlertCircle size={16} className="text-red-500 dark:text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-300 dark:text-red-400">{d.vendorName}</p>
              <p className="text-xs text-red-600 dark:text-red-400">{formatCurrency(d.outstandingAmount)} overdue</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-bold text-red-600 dark:text-red-400">{Math.abs(d.daysRemaining)}d overdue</p>
            <ChevronRight size={14} className="ml-auto text-red-400" />
          </div>
        </Link>
      ))}

      {/* Due within 7 days */}
      {upcoming.map(d => (
        <Link key={d.accountId} href={`/dashboard/khata/${d.accountId}`}
          className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 px-4 py-3 transition-colors hover:bg-amber-50 dark:hover:bg-amber-900/20">
          <div className="flex items-center gap-3">
            <Bell size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{d.vendorName}</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Due: {formatDateShort(d.dueDate)}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{d.daysRemaining === 0 ? "Today" : `${d.daysRemaining}d left`}</p>
            <ChevronRight size={14} className="ml-auto text-amber-400" />
          </div>
        </Link>
      ))}

      {/* Later dues */}
      {later.map(d => (
        <Link key={d.accountId} href={`/dashboard/khata/${d.accountId}`}
          className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <div className="flex items-center gap-3">
            <CalendarDays size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{d.vendorName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatCurrency(d.outstandingAmount)} · Due: {formatDateShort(d.dueDate)}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">{d.daysRemaining}d left</p>
            <ChevronRight size={14} className="ml-auto text-gray-300 dark:text-gray-500" />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Credit Request Form ─────────────────────────────────────────────────────

function CreditRequestForm({ accounts, onSuccess }: { accounts: AccountWithVendor[]; onSuccess: () => void }) {
  const [accountId, setAccountId] = useState("");
  const [requestedLimit, setRequestedLimit] = useState("");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const activeAccounts = accounts.filter(a => a.status === "ACTIVE");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !requestedLimit) { setError("Please select an account and enter a limit"); return; }
    const account = accounts.find(a => a.id === accountId);
    if (account && Number(requestedLimit) <= account.creditLimitAmount) {
      setError(`Requested limit must exceed current limit (${formatCurrency(account.creditLimitAmount)})`);
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await apiClient.post(`/khata/accounts/${accountId}/requests`, {
        requestedLimit: Number(requestedLimit),
        reason: reason.trim() || undefined,
      });
      toast.success("Credit limit request submitted");
      setRequestedLimit("");
      setReason("");
      setAccountId("");
      onSuccess();
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
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">Account *</label>          <select value={accountId} onChange={(e) => { setAccountId(e.target.value); setError(""); }}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400">
          <option value="">Select a vendor account...</option>
          {activeAccounts.map(a => (
            <option key={a.id} value={a.id}>{a.vendor?.businessName} — Current: {formatCompact(a.creditLimitAmount)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">New Requested Limit *</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">₹</span>
          <input type="number" step="1" min="1" value={requestedLimit}
            onChange={(e) => { setRequestedLimit(e.target.value); setError(""); }}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 pl-8 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20" />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">Reason</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 resize-none"
          placeholder="Why do you need a higher limit? (e.g., Rabi season)" />
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      <button type="submit" disabled={isSaving}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 dark:bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow dark:shadow-gray-950/20 hover:bg-emerald-800 disabled:opacity-50 transition-all">
        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        Submit Request
      </button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FarmerKhataDashboard() {
  const { user } = useAuthStore();
  const [accounts, setAccounts] = useState<AccountWithVendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreditForm, setShowCreditForm] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: { accounts: AccountWithVendor[]; total: number } }>(
        "/khata/accounts", { params: { limit: 100 } }
      );
      setAccounts(res.data.data.accounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  // Compute derived data
  const totalOutstanding = accounts.reduce((sum, a) => sum + a.outstandingAmount, 0);
  const totalCreditLimit = accounts.reduce((sum, a) => sum + a.creditLimitAmount, 0);
  const overdueCount = accounts.filter(a => a.status === "OVERDUE").length;
  const settledCount = accounts.filter(a => a.status === "SETTLED").length;
  const activeCount = accounts.filter(a => a.status === "ACTIVE").length;

  const now = new Date();
  const dues: DueItem[] = accounts
    .filter(a => a.dueDateNextPayment && a.status !== "SETTLED")
    .map(a => {
      const dueDate = new Date(a.dueDateNextPayment!);
      const diffTime = dueDate.getTime() - now.getTime();
      const daysRemaining = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return {
        accountId: a.id,
        vendorName: a.vendor?.businessName ?? "Vendor",
        outstandingAmount: a.outstandingAmount,
        dueDate: a.dueDateNextPayment,
        daysRemaining,
        status: a.status,
      };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const pendingRequests = accounts.filter(a => a.status === "ACTIVE").length;
  const isFarmer = user?.role === "FARMER";

  if (!isFarmer && user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="flex flex-col items-center">
          <Ban size={32} className="text-gray-300 dark:text-gray-500" />
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100">Farmer Dashboard</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">This dashboard is only available for farmers</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Khata Dashboard</h1>
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-900/30 px-3 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
                <AlertTriangle size={11} />
                {overdueCount} overdue
              </span>
            )}
            {activeCount === 0 && accounts.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/30 px-3 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                All Settled
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
            Track your credit accounts, due dates, and manage repayments with vendors
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/khata"
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            All Accounts
          </Link>
          <button
            onClick={() => setShowCreditForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 dark:bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 transition-colors"
          >
            <Plus size={14} />
            Request Limit
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading your accounts...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/30">
            <AlertTriangle size={28} className="text-red-300 dark:text-red-400" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100">{error}</h2>
          <button onClick={() => fetchAccounts()} className="mt-4 rounded-lg border border-gray-300 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            Try Again
          </button>
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30">
            <BookOpen size={36} className="text-emerald-300 dark:text-emerald-400" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100">No khata accounts yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Your vendors will create accounts for you</p>
          <Link href="/dashboard/khata" className="mt-6 rounded-lg border border-gray-300 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            Go to KhataBook
          </Link>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Outstanding"
              value={formatCurrency(totalOutstanding)}
              sublabel={`Across ${accounts.length} account${accounts.length !== 1 ? "s" : ""}`}
              icon={IndianRupee}
              color="bg-emerald-600 dark:bg-emerald-700 dark:bg-emerald-600"
            />
            <StatCard
              label="Total Credit Limit"
              value={formatCompact(totalCreditLimit)}
              sublabel={`${totalCreditLimit > 0 ? ((totalOutstanding / totalCreditLimit) * 100).toFixed(0) : "0"}% utilized`}
              icon={Landmark}
              color="bg-blue-600 dark:bg-blue-700"
            />
            <StatCard
              label="Active Accounts"
              value={activeCount.toString()}
              sublabel={`${settledCount > 0 ? `${settledCount} settled` : ""}`}
              icon={CheckCircle2}
              color={overdueCount > 0 ? "bg-amber-600 dark:bg-amber-700" : "bg-emerald-600 dark:bg-emerald-700 dark:bg-emerald-600"}
            />
            <StatCard
              label="Overdue"
              value={overdueCount.toString()}
              sublabel={overdueCount > 0 ? "Needs immediate attention" : "All on track"}
              icon={overdueCount > 0 ? AlertTriangle : Clock}
              color={overdueCount > 0 ? "bg-red-600 dark:bg-red-700" : "bg-gray-500 dark:bg-gray-600"}
              trend={overdueCount > 0 ? { up: false, value: `${overdueCount} overdue` } : undefined}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left column: Accounts + Credit Request */}
            <div className="lg:col-span-2 space-y-6">
              {/* Repayment Reminders */}
              {dues.length > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
                      <Bell size={15} className="text-amber-600 dark:text-amber-400" />
                      Repayment Reminders
                      {dues.filter(d => d.status === "OVERDUE" || d.daysRemaining <= 7).length > 0 && (
                        <span className="rounded-full bg-red-50 dark:bg-red-900/30 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:text-red-400">
                          {dues.filter(d => d.status === "OVERDUE" || d.daysRemaining <= 7).length} urgent
                        </span>
                      )}
                    </h2>
                  </div>
                  <DueReminderSection dues={dues} loading={false} />
                </div>
              )}

              {/* Accounts List */}
              <div>
                <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
                  <Landmark size={15} className="text-gray-400 dark:text-gray-500" />
                  Your Accounts
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400 dark:text-gray-500">({accounts.length})</span>
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {accounts.map(account => (
                    <AccountCard key={account.id} account={account} />
                  ))}
                </div>
              </div>
            </div>

            {/* Right column: Quick Actions + Info */}
            <div className="space-y-4">
              {/* Credit Request Form */}
              {showCreditForm && (
                <div className="relative">
                  <button
                    onClick={() => setShowCreditForm(false)}
                    className="absolute top-3 right-3 z-10 rounded-lg p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-500"
                  >
                    <X size={14} />
                  </button>
                  <CreditRequestForm accounts={accounts} onSuccess={() => setShowCreditForm(false)} />
                </div>
              )}

              {/* How to Pay */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
                  <IndianRupee size={15} className="text-emerald-600 dark:text-emerald-400" />
                  How to Make a Payment
                </h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-xs font-bold text-emerald-700 dark:text-emerald-400">1</div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-500">Click <strong>&quot;View Details&quot;</strong> on your account card</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-xs font-bold text-emerald-700 dark:text-emerald-400">2</div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-500">Check the vendor&apos;s UPI ID or bank details</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-xs font-bold text-emerald-700 dark:text-emerald-400">3</div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-500">Make the payment and share the UPI transaction ID or receipt with your vendor</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-xs font-bold text-emerald-700 dark:text-emerald-400">4</div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-500">The vendor will update your khata balance</p>
                  </div>
                </div>
              </div>

              {/* Quick Summary */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Account Summary</h3>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2">
                    <span className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-500">Active</span>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{activeCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2">
                    <span className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-500">Settled</span>
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400">{settledCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2">
                    <span className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-500">Overdue</span>
                    <span className="text-xs font-bold text-red-700 dark:text-red-400">{overdueCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2">
                    <span className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-500">Avg Outstanding</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                      {accounts.length > 0 ? formatCurrency(Math.round(totalOutstanding / accounts.length)) : "₹0"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2">
                    <span className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-500">Avg Interest Rate</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                      {accounts.length > 0 ? `${(accounts.reduce((s, a) => s + a.interestRatePct, 0) / accounts.length).toFixed(1)}%` : "0%"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Statement Download */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
                  <Download size={15} className="text-gray-400 dark:text-gray-500" />
                  Statement
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-3">Download your khata statement as PDF</p>
                <Link
                  href="/dashboard/khata"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                >
                  <Download size={13} />
                  Download Statement
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
