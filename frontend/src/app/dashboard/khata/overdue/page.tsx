"use client";

import { useEffect, useState, useCallback } from "react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import {
  AlertTriangle,
  Loader2,
  Phone,
  CalendarDays,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface OverdueAccount {
  id: string;
  farmerName: string;
  farmerPhone: string;
  outstandingAmount: number;
  creditLimitAmount: number;
  daysOverdue: number;
  dueDate: string | null;
  vendor?: { businessName: string };
  farmer?: { user: { fullName: string; phoneNumber: string } };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function DaysBadge({ days }: { days: number }) {
  if (days <= 7)
    return <span className="rounded-full bg-amber-50 dark:bg-amber-900/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">{days}d overdue</span>;
  if (days <= 30)
    return <span className="rounded-full bg-orange-50 dark:bg-orange-900/30 px-2.5 py-0.5 text-[11px] font-semibold text-orange-800">{days}d overdue</span>;
  return <span className="rounded-full bg-red-50 dark:bg-red-900/30 px-2.5 py-0.5 text-[11px] font-semibold text-red-800 dark:text-red-300 dark:text-red-400">{days}d overdue</span>;
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-20">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30">
        <CheckCircle2 size={28} className="text-emerald-300 dark:text-emerald-400" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">No overdue accounts</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">All khata accounts are in good standing</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverdueAccountsPage() {
  const { user } = useAuthStore();
  const [accounts, setAccounts] = useState<OverdueAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [minDays, setMinDays] = useState(1);

  const isAdmin = user?.role === "ADMIN";

  const loadOverdue = useCallback(async (p: number, minDaysOverdue: number) => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: { accounts: OverdueAccount[]; total: number; page: number; totalPages: number };
      }>("/khata/accounts/overdue", { params: { page: p, limit: 20, minDaysOverdue } });
      setAccounts(res.data.data.accounts);
      setTotal(res.data.data.total);
      setPage(res.data.data.page);
      setTotalPages(res.data.data.totalPages);
    } catch {
      toast.error("Failed to load overdue accounts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadOverdue(page, minDays); }, [page, minDays, loadOverdue]);

  const handlePageChange = (p: number) => { if (p >= 1 && p <= totalPages) setPage(p); };

  return (
    <RoleGuard allowedRoles={["VENDOR", "ADMIN"]}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/30">
              <AlertTriangle size={24} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Overdue Accounts</h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                {isAdmin
                  ? "All overdue khata accounts across all vendors"
                  : "Farmers with overdue khata payments"}
              </p>
            </div>
          </div>

          {/* Min days filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">Min overdue:</label>
            <select value={minDays} onChange={(e) => { setMinDays(Number(e.target.value)); setPage(1); }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400">
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
              <option value={15}>15 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
        </div>

        {/* Summary banner */}
        {!isLoading && accounts.length > 0 && (
          <div className="mb-6 rounded-xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20 p-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
              <p className="text-sm font-medium text-red-800 dark:text-red-300 dark:text-red-400">
                {total} account{total !== 1 ? "s" : ""} overdue
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-red-500 dark:text-red-400" /></div>
        ) : accounts.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {accounts.map((acc) => (
              <Link key={acc.id} href={`/dashboard/khata/${acc.id}`}
                className="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30 hover:border-red-200 dark:hover:border-red-700">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {acc.farmerName || acc.farmer?.user.fullName || "Unknown"}
                      </h3>
                      <DaysBadge days={acc.daysOverdue} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      {acc.farmerPhone && (
                        <span className="flex items-center gap-1"><Phone size={11} /> {acc.farmerPhone}</span>
                      )}
                      {acc.dueDate && (
                        <span className="flex items-center gap-1"><CalendarDays size={11} /> Due: {formatDate(acc.dueDate)}</span>
                      )}
                      {acc.vendor?.businessName && (
                        <span className="text-gray-400 dark:text-gray-500">Vendor: {acc.vendor.businessName}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(acc.outstandingAmount)}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Limit: {formatCurrency(acc.creditLimitAmount)}</p>
                  </div>
                </div>
              </Link>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Page {page} of {totalPages}</span>
                <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            )}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
