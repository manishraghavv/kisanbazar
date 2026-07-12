"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  IndianRupee,
  Percent,
  Phone,
  ArrowRight,
  RefreshCw,
  BarChart3,
  PieChart,
  Activity,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnalyticsData {
  summary: {
    totalAccounts: number;
    totalOutstanding: number;
    totalCreditLimit: number;
    totalOverdueAccounts: number;
    totalOverdueAmount: number;
    collectionRate: number;
    totalCreditGiven: number;
    totalRepaid: number;
    utilizationRate: number;
  };
  statusDistribution: Record<string, number>;
  overdueAccounts: Array<{
    id: string;
    farmerName: string;
    farmerPhone: string;
    outstandingAmount: number;
    creditLimitAmount: number;
    daysOverdue: number;
    dueDate: string | null;
  }>;
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{value}</p>
          {sublabel && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{sublabel}</p>}
          {trend && (
            <p className={`mt-1 flex items-center gap-0.5 text-xs font-semibold ${trend.up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
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

// ─── Overdue Accounts Table ──────────────────────────────────────────────────

function OverdueTable({ accounts, loading }: { accounts: AnalyticsData["overdueAccounts"]; loading: boolean }) {
  if (loading) {
    return <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-emerald-700 dark:text-emerald-400" /></div>;
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center py-10">
        <CheckCircle2 size={32} className="text-emerald-400" />
        <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-300 dark:text-gray-300">No overdue accounts</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">All your khata accounts are in good standing</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 dark:border-gray-700 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            <th className="pb-3 pl-0 pr-4">Farmer</th>
            <th className="pb-3 px-4">Outstanding</th>
            <th className="pb-3 px-4">Credit Limit</th>
            <th className="pb-3 px-4">Days Overdue</th>
            <th className="pb-3 px-4">Due Date</th>
            <th className="pb-3 pl-4 pr-0"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 dark:divide-gray-700">
          {accounts.map((acc) => (
            <tr key={acc.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50/50 transition-colors">
              <td className="py-3.5 pl-0 pr-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {acc.farmerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100 truncate">{acc.farmerName}</p>
                    <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      <Phone size={10} />
                      {acc.farmerPhone}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3.5">
                <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(acc.outstandingAmount)}</span>
              </td>
              <td className="px-4 py-3.5 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatCurrency(acc.creditLimitAmount)}</td>
              <td className="px-4 py-3.5">
                {acc.daysOverdue > 0 ? (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    acc.daysOverdue > 60 ? "bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
                    acc.daysOverdue > 30 ? "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                    "bg-yellow-50 dark:bg-yellow-900/30 dark:bg-yellow-900/30 text-yellow-700"
                  }`}>
                    <AlertTriangle size={10} />
                    {acc.daysOverdue}d
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">—</span>
                )}
              </td>
              <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatDate(acc.dueDate)}</td>
              <td className="pl-4 pr-0 py-3.5">
                <Link
                  href={`/dashboard/khata/${acc.id}`}
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-emerald-800 dark:hover:text-emerald-300"
                >
                  View <ArrowRight size={12} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Status Distribution Bar ─────────────────────────────────────────────────

function StatusDistribution({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 italic text-center py-6">No accounts</p>;
  }

  const colors: Record<string, string> = {
    ACTIVE: "bg-emerald-500",
    SETTLED: "bg-blue-500",
    OVERDUE: "bg-red-500",
    SUSPENDED: "bg-amber-500",
    WRITTEN_OFF: "bg-gray-400",
  };

  const labels: Record<string, string> = {
    ACTIVE: "Active",
    SETTLED: "Settled",
    OVERDUE: "Overdue",
    SUSPENDED: "Suspended",
    WRITTEN_OFF: "Written Off",
  };

  const items = Object.entries(distribution).filter(([, count]) => count > 0);

  return (
    <div>
      {/* Stacked bar */}
      <div className="flex h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700 dark:bg-gray-700">
        {items.map(([status, count]) => (
          <div
            key={status}
            className={`${colors[status] ?? "bg-gray-300"} transition-all`}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${labels[status] ?? status}: ${count}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {items.map(([status, count]) => (
          <div key={status} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${colors[status] ?? "bg-gray-300"}`} />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 dark:text-gray-300">{labels[status] ?? status}</span>
            </div>
            <span className="text-xs font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{count}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-center text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
        {total} total account{total !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

// ─── Recovery Funnel ─────────────────────────────────────────────────────────

function RecoveryFunnel({
  totalCreditGiven,
  totalRepaid,
  collectionRate,
}: {
  totalCreditGiven: number;
  totalRepaid: number;
  collectionRate: number;
}) {
  return (
    <div className="space-y-3">
      {/* Credit Given */}
      <div className="relative rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/50 p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Total Credit Given</p>
          <TrendingUp size={14} className="text-amber-600 dark:text-amber-400" />
        </div>
        <p className="text-xl font-bold text-amber-900">{formatCompact(totalCreditGiven)}</p>
        {/* Funnel arrow connector */}
      </div>

      <div className="flex justify-center">
        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 dark:border-gray-600 dark:border-gray-600 dark:border-gray-600 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
          <ArrowRight size={12} />
        </div>
      </div>

      {/* Repaid */}
      <div className="relative rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-100/50 p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Repaid</p>
          <TrendingDown size={14} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-xl font-bold text-emerald-900">{formatCompact(totalRepaid)}</p>
      </div>

      <div className="flex justify-center">
        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 dark:border-gray-600 dark:border-gray-600 dark:border-gray-600 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
          <ArrowRight size={12} />
        </div>
      </div>

      {/* Collection Rate */}
      <div className="relative rounded-xl bg-gradient-to-r from-blue-50 to-blue-100/50 p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">Collection Rate</p>
          <Percent size={14} className="text-blue-600" />
        </div>
        <p className="text-2xl font-bold text-blue-900">{collectionRate.toFixed(1)}%</p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-200">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${Math.min(collectionRate, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KhataAnalyticsPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: AnalyticsData }>("/khata/analytics");
      setData(res.data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchAnalytics(true);
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-2">Khata Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Please log in to view analytics</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Khata Analytics</h1>
            {data?.summary.totalOverdueAccounts && data.summary.totalOverdueAccounts > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30 px-3 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
                <AlertTriangle size={11} />
                {data.summary.totalOverdueAccounts} overdue
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Credit performance, recovery metrics, and overdue tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/khata"
            className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 transition-colors"
          >
            All Khata Accounts
          </Link>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading analytics...</p>
          </div>
        </div>
      ) : error || !data ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30">
            <AlertTriangle size={28} className="text-red-300" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{error ?? "Failed to load analytics"}</h2>
          <button onClick={() => fetchAnalytics()} className="mt-4 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50">
            Try Again
          </button>
        </div>
      ) : (
        <>
          {/* Summary Stat Cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Outstanding"
              value={formatCurrency(data.summary.totalOutstanding)}
              sublabel={`${data.summary.totalAccounts} account${data.summary.totalAccounts !== 1 ? "s" : ""}`}
              icon={IndianRupee}
              color="bg-emerald-600"
              trend={
                data.summary.totalOutstanding > 0
                  ? { up: true, value: `₹${formatCompact(data.summary.totalOutstanding)} owed` }
                  : undefined
              }
            />
            <StatCard
              label="Credit Limit"
              value={formatCurrency(data.summary.totalCreditLimit)}
              sublabel={`${data.summary.utilizationRate.toFixed(1)}% utilized`}
              icon={BarChart3}
              color="bg-blue-600"
            />
            <StatCard
              label="Overdue Accounts"
              value={data.summary.totalOverdueAccounts.toString()}
              sublabel={`${formatCurrency(data.summary.totalOverdueAmount)} overdue`}
              icon={AlertTriangle}
              color="bg-red-600"
            />
            <StatCard
              label="Collection Rate"
              value={`${data.summary.collectionRate.toFixed(1)}%`}
              sublabel={`${formatCompact(data.summary.totalRepaid)} repaid of ${formatCompact(data.summary.totalCreditGiven)}`}
              icon={TrendingUp}
              color={data.summary.collectionRate >= 70 ? "bg-emerald-600" : "bg-amber-600"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left: Overdue Accounts Table */}
            <div className="lg:col-span-2 space-y-6">
              {/* Overdue Accounts */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                    Overdue Accounts
                    {data.overdueAccounts.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">({data.overdueAccounts.length})</span>
                    )}
                  </h2>
                  <Link
                    href="/dashboard/khata"
                    className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300"
                  >
                    Manage Accounts →
                  </Link>
                </div>
                <OverdueTable accounts={data.overdueAccounts} loading={false} />
              </div>

              {/* Status Distribution */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
                <div className="flex items-center gap-2 mb-4">
                  <PieChart size={16} className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Account Status Breakdown</h2>
                </div>
                <StatusDistribution distribution={data.statusDistribution} />
              </div>
            </div>

            {/* Right: Recovery Funnel */}
            <div className="space-y-4">
              {/* Recovery Funnel */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={16} className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Recovery Funnel</h2>
                </div>
                <RecoveryFunnel
                  totalCreditGiven={data.summary.totalCreditGiven}
                  totalRepaid={data.summary.totalRepaid}
                  collectionRate={data.summary.collectionRate}
                />
              </div>

              {/* Quick Summary Stats */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-3">Quick Summary</h2>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-3 py-2">
                    <span className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">Active Accounts</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{data.statusDistribution.ACTIVE}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-3 py-2">
                    <span className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">Settled</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{data.statusDistribution.SETTLED}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-3 py-2">
                    <span className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">Overdue Rate</span>
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">
                      {data.summary.totalAccounts > 0
                        ? `${((data.statusDistribution.OVERDUE / data.summary.totalAccounts) * 100).toFixed(1)}%`
                        : "0%"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-3 py-2">
                    <span className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">Avg Outstanding</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                      {data.summary.totalAccounts > 0
                        ? formatCurrency(Math.round(data.summary.totalOutstanding / data.summary.totalAccounts))
                        : formatCurrency(0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-3 py-2">
                    <span className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">Suspended / Written Off</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{data.statusDistribution.SUSPENDED + data.statusDistribution.WRITTEN_OFF}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
