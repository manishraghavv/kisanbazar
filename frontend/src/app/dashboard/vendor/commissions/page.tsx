"use client";

import { useEffect, useState } from "react";
import { useVendorStore } from "@/stores/vendorStore";
import { toast } from "sonner";
import {
  IndianRupee,
  TrendingUp,
  Percent,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Receipt,
} from "lucide-react";
import Link from "next/link";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function CommissionsPage() {
  const { commissions, commissionSummary, commissionsTotal, commissionsPage, commissionsTotalPages, isCommissionsLoading, fetchCommissions } = useVendorStore();
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchCommissions(page, 20).catch(() => toast.error("Failed to load commissions"));
  }, [page, fetchCommissions]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Commissions</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Your earnings from orders</p>
      </div>

      {/* Summary cards */}
      {commissionSummary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Gross Sales</p>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30"><TrendingUp size={16} className="text-blue-700 dark:text-blue-400" /></div>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(commissionSummary.totalGrossAmount)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Commission</p>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30"><Percent size={16} className="text-amber-700 dark:text-amber-400" /></div>
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-400">{formatCurrency(commissionSummary.totalCommissionAmount)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Net Earnings</p>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30"><IndianRupee size={16} className="text-emerald-700 dark:text-emerald-400" /></div>
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(commissionSummary.totalNetAmount)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Total Orders</p>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/30 dark:bg-purple-900/30"><Receipt size={16} className="text-purple-700 dark:text-purple-400" /></div>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{commissionSummary.count}</p>
          </div>
        </div>
      )}

      {isCommissionsLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" /></div>
      ) : commissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30"><IndianRupee size={36} className="text-emerald-300" /></div>
          <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">No commissions yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Commissions will appear once orders are delivered</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{commissionsTotal} commission{commissionsTotal !== 1 ? "s" : ""}</p>
          <div className="space-y-3">
            {commissions.map((c) => (
              <div key={c.id} className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/orders`} className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
                        {c.order?.orderNumber ?? "—"}
                      </Link>
                      <span className="rounded-full bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300 dark:text-gray-300">
                        {c.commissionRate}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatDate(c.createdAt)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(c.grossAmount)}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">-{formatCurrency(c.commissionAmount)}</p>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(c.netAmount)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {commissionsTotalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
                className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"><ChevronLeft size={16} /></button>
              <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Page {page} of {commissionsTotalPages}</span>
              <button onClick={() => setPage(p => Math.min(commissionsTotalPages, p+1))} disabled={page >= commissionsTotalPages}
                className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
