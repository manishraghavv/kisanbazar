"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import {
  BookOpen,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  IndianRupee,
  RefreshCw,
  BarChart3,
  AlertCircle,
  Activity,
  Zap,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminKhataData {
  summary: {
    totalAccounts: number;
    totalOutstanding: number;
    totalCreditLimit: number;
    totalOverdueAccounts: number;
    utilizationRate: number;
    avgOutstanding: number;
  };
  statusDistribution: Record<string, number>;
  overdueAccounts: Array<{
    id: string;
    vendorName: string;
    farmerName: string;
    farmerPhone: string;
    outstandingAmount: number;
    daysOverdue: number;
  }>;
  vendorBreakdown: Array<{
    vendorId: string;
    businessName: string;
    accountCount: number;
    totalOutstanding: number;
    totalCreditLimit: number;
  }>;
}

interface CronStatus {
  [key: string]: {
    lastRun: string | null;
    lastStatus: string;
    accountsProcessed?: number;
    errors?: string;
  };
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

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sublabel, icon: Icon, color }: {
  label: string; value: string; sublabel?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>; color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{value}</p>
          {sublabel && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{sublabel}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminKhataOverviewPage() {
  const [data, setData] = useState<AdminKhataData | null>(null);
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cronLoading, setCronLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const [overviewRes, cronRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: AdminKhataData }>("/khata/admin/overview"),
        apiClient.get<{ success: boolean; data: CronStatus }>("/admin/crons/status"),
      ]);
      setData(overviewRes.data.data);
      setCronStatus(cronRes.data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overview");
    } finally { setIsLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const triggerCron = async (name: string, endpoint: string) => {
    setCronLoading(name);
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>(endpoint);
      toast.success(res.data.message);
      fetchOverview();
    } catch {
      toast.error(`Failed to trigger ${name}`);
    } finally { setCronLoading(null); }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" /></div>;
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle size={28} className="text-red-300" />
        <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{error ?? "Failed to load"}</h2>
        <button onClick={fetchOverview} className="mt-4 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50">Retry</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Khata Overview</h1>
            {data.summary.totalOverdueAccounts > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30 px-3 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
                <AlertCircle size={11} />{data.summary.totalOverdueAccounts} overdue
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Cross-vendor khata analytics, recovery metrics, and system controls</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchOverview} className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 transition-colors">
            <RefreshCw size={14} />Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Accounts" value={data.summary.totalAccounts.toString()} sublabel="Across all vendors" icon={BookOpen} color="bg-emerald-600" />
        <StatCard label="Total Outstanding" value={formatCurrency(data.summary.totalOutstanding)} sublabel={`Avg ${formatCurrency(data.summary.avgOutstanding)} per account`} icon={IndianRupee} color="bg-blue-600" />
        <StatCard label="Overdue Accounts" value={data.summary.totalOverdueAccounts.toString()} sublabel={`${data.summary.totalAccounts > 0 ? ((data.summary.totalOverdueAccounts / data.summary.totalAccounts) * 100).toFixed(1) : 0}% default rate`} icon={AlertTriangle} color={data.summary.totalOverdueAccounts > 0 ? "bg-red-600" : "bg-gray-500"} />
        <StatCard label="Credit Utilization" value={`${data.summary.utilizationRate.toFixed(1)}%`} sublabel={`Limit: ${formatCompact(data.summary.totalCreditLimit)}`} icon={BarChart3} color="bg-purple-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Overdue + Vendor Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overdue Accounts */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-4">
              Overdue Accounts
              {data.overdueAccounts.length > 0 && <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">({data.overdueAccounts.length})</span>}
            </h2>
            {data.overdueAccounts.length === 0 ? (
              <div className="flex flex-col items-center py-8">
                <CheckCircle2 size={28} className="text-emerald-400" />
                <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-300 dark:text-gray-300">No overdue accounts</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 dark:border-gray-700 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      <th className="pb-2 pl-0 pr-3">Vendor</th>
                      <th className="pb-2 px-3">Farmer</th>
                      <th className="pb-2 px-3">Outstanding</th>
                      <th className="pb-2 pl-3 pr-0">Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700 dark:divide-gray-700">
                    {data.overdueAccounts.slice(0, 10).map(a => (
                      <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50/50 transition-colors">
                        <td className="py-2.5 pl-0 pr-3 text-xs font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{a.vendorName}</td>
                        <td className="px-3 py-2.5">
                          <p className="text-xs font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{a.farmerName}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{a.farmerPhone}</p>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-bold text-red-600 dark:text-red-400">{formatCurrency(a.outstandingAmount)}</td>
                        <td className="pl-3 pr-0 py-2.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            a.daysOverdue > 60 ? "bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30 text-red-700 dark:text-red-400" : a.daysOverdue > 30 ? "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "bg-yellow-50 dark:bg-yellow-900/30 dark:bg-yellow-900/30 text-yellow-700"
                          }`}>{a.daysOverdue}d</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Vendor Breakdown */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-4">Vendor Breakdown</h2>
            {data.vendorBreakdown.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 italic py-6 text-center">No vendors with khata accounts</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 dark:border-gray-700 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      <th className="pb-2 pl-0 pr-3">Vendor</th>
                      <th className="pb-2 px-3">Accounts</th>
                      <th className="pb-2 px-3">Outstanding</th>
                      <th className="pb-2 px-3">Credit Limit</th>
                      <th className="pb-2 pl-3 pr-0">Utilization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700 dark:divide-gray-700">
                    {data.vendorBreakdown.map(v => {
                      const utilization = v.totalCreditLimit > 0 ? (v.totalOutstanding / v.totalCreditLimit) * 100 : 0;
                      return (
                        <tr key={v.vendorId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50/50 transition-colors">
                          <td className="py-2.5 pl-0 pr-3">
                            <Link href={`/dashboard/admin/users`} className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300">{v.businessName}</Link>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-200 dark:text-gray-200">{v.accountCount}</td>
                          <td className="px-3 py-2.5 text-xs font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCompact(v.totalOutstanding)}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatCompact(v.totalCreditLimit)}</td>
                          <td className="pl-3 pr-0 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700 dark:bg-gray-700">
                                <div className={`h-full rounded-full ${utilization > 80 ? "bg-red-500" : utilization > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                                  style={{ width: `${Math.min(utilization, 100)}%` }} />
                              </div>
                              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{utilization.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Controls + Status */}
        <div className="space-y-4">
          {/* Escalation Controls */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-4">
              <Zap size={15} className="text-amber-600 dark:text-amber-400" />
              System Controls
            </h2>
            <div className="space-y-2.5">
              <button onClick={() => triggerCron("interest", "/admin/crons/interest")} disabled={cronLoading === "interest"}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-amber-50 dark:bg-amber-900/30 hover:border-amber-200 disabled:opacity-50 transition-all">
                <span>Calculate Interest</span>
                {cronLoading === "interest" ? <Loader2 size={14} className="animate-spin" /> : <span className="text-amber-600 dark:text-amber-400">Run</span>}
              </button>
              <button onClick={() => triggerCron("overdue", "/admin/crons/overdue")} disabled={cronLoading === "overdue"}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 hover:border-red-200 disabled:opacity-50 transition-all">
                <span>Overdue Escalation</span>
                {cronLoading === "overdue" ? <Loader2 size={14} className="animate-spin" /> : <span className="text-red-600 dark:text-red-400">Run</span>}
              </button>
              <button onClick={() => triggerCron("reminders", "/admin/crons/reminders")} disabled={cronLoading === "reminders"}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-blue-50 dark:bg-blue-900/30 hover:border-blue-200 disabled:opacity-50 transition-all">
                <span>Send Reminders</span>
                {cronLoading === "reminders" ? <Loader2 size={14} className="animate-spin" /> : <span className="text-blue-600">Run</span>}
              </button>
            </div>
          </div>

          {/* Cron Status */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-3">
              <Activity size={15} className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
              Cron Job Status
            </h2>
            <div className="space-y-2.5">
              {cronStatus && Object.entries(cronStatus).map(([key, status]) => (
                <div key={key} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-200 dark:text-gray-200 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 truncate">
                      {status.lastRun ? formatDateTime(status.lastRun) : "Never run"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    status.lastStatus === "success" ? "bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
                    status.lastStatus === "never" ? "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" :
                    "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                  }`}>
                    {status.lastStatus === "success" ? "OK" : status.lastStatus === "never" ? "—" : "Issues"}
                  </span>
                </div>
              ))}
              {!cronStatus && <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 italic">Loading status...</p>}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-3">
              <BarChart3 size={15} className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
              Quick Stats
            </h2>
            <div className="space-y-2.5">
              {Object.entries(data.statusDistribution).filter(([, count]) => count > 0).map(([status, count]) => {
                const colors: Record<string, string> = {
                  ACTIVE: "text-emerald-700 dark:text-emerald-400", SETTLED: "text-blue-700 dark:text-blue-400", OVERDUE: "text-red-700 dark:text-red-400",
                  SUSPENDED: "text-amber-700 dark:text-amber-400", WRITTEN_OFF: "text-gray-700 dark:text-gray-200 dark:text-gray-200",
                };
                return (
                  <div key={status} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-3 py-2">
                    <span className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">{status.charAt(0) + status.slice(1).toLowerCase()}</span>
                    <span className={`text-xs font-bold ${colors[status] ?? "text-gray-700 dark:text-gray-200 dark:text-gray-200"}`}>{count}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-3 py-2">
                <span className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">Avg Outstanding</span>
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(data.summary.avgOutstanding)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-3 py-2">
                <span className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">Overdue Rate</span>
                <span className={`text-xs font-bold ${data.summary.totalOverdueAccounts > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {data.summary.totalAccounts > 0 ? ((data.summary.totalOverdueAccounts / data.summary.totalAccounts) * 100).toFixed(1) : "0"}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
