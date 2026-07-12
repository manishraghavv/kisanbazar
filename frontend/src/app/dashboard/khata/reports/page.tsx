"use client";

import { useEffect, useState, useCallback } from "react";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/authStore";
import {
  BarChart3,
  BookOpen,
  Loader2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Ban,
  IndianRupee,
  Percent,
  Users,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Download,
  Activity,
} from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCompact(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface KhataReportSummary {
  totalAccounts: number;
  totalOutstanding: number;
  totalCreditLimit: number;
  totalOverdueAccounts: number;
  totalOverdueAmount: number;
  collectionRate: number;
  totalCreditGiven: number;
  totalRepaid: number;
  utilizationRate: number;
}

interface OverdueAccount {
  id: string;
  farmerName: string;
  farmerPhone: string;
  outstandingAmount: number;
  creditLimitAmount: number;
  daysOverdue: number;
  dueDate: string | null;
}

interface VendorBreakdownItem {
  vendorId: string;
  businessName: string;
  accountCount: number;
  totalOutstanding: number;
  totalCreditLimit: number;
}

interface StatusDistribution {
  ACTIVE: number;
  SETTLED: number;
  OVERDUE: number;
  SUSPENDED: number;
  WRITTEN_OFF: number;
}

interface KhataAnalyticsResponse {
  summary: KhataReportSummary;
  statusDistribution: StatusDistribution;
  overdueAccounts: OverdueAccount[];
}

interface MonthlyDataPoint {
  month: string;
  debitAmount: number;
  debitCount: number;
  repaymentAmount: number;
  repaymentCount: number;
}

interface OutstandingTrendPoint {
  month: string;
  netOutstanding: number;
}

interface KhataTrendsResponse {
  monthlyDebits: MonthlyDataPoint[];
  outstandingTrend: OutstandingTrendPoint[];
}

interface AdminOverviewResponse {
  summary: {
    totalAccounts: number;
    totalOutstanding: number;
    totalCreditLimit: number;
    totalOverdueAccounts: number;
    utilizationRate: number;
    avgOutstanding: number;
  };
  statusDistribution: StatusDistribution;
  overdueAccounts: OverdueAccount[];
  vendorBreakdown: VendorBreakdownItem[];
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">{value}</p>
          {sublabel && <p className="mt-0.5 text-xs text-gray-400">{sublabel}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, count }: { status: string; count: number }) {
  const config: Record<string, { bg: string; text: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
    ACTIVE: { bg: "bg-emerald-100", text: "text-emerald-800", icon: CheckCircle2 },
    SETTLED: { bg: "bg-blue-100", text: "text-blue-800", icon: CheckCircle2 },
    OVERDUE: { bg: "bg-red-100", text: "text-red-800", icon: AlertTriangle },
    SUSPENDED: { bg: "bg-amber-100", text: "text-amber-800", icon: Ban },
    WRITTEN_OFF: { bg: "bg-gray-100", text: "text-gray-800", icon: Ban },
  };
  const c = config[status] ?? { bg: "bg-gray-100", text: "text-gray-700", icon: AlertCircle };
  const Icon = c.icon;

  return (
    <div className={`flex items-center gap-2 rounded-lg ${c.bg} px-3 py-2`}>
      <Icon size={14} className={c.text} />
      <span className={`text-xs font-semibold ${c.text}`}>
        {status.replace(/_/g, " ")}: {count}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KhataReportsPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<KhataAnalyticsResponse | AdminOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trends, setTrends] = useState<KhataTrendsResponse | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [overduePage, setOverduePage] = useState(1);
  const overdueLimit = 5;

  const isAdmin = user?.role === "ADMIN";
  const isVendor = user?.role === "VENDOR";

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (isAdmin) {
        const res = await apiClient.get<{ success: boolean; data: AdminOverviewResponse }>("/khata/admin/overview");
        setData(res.data.data);
      } else if (isVendor) {
        const res = await apiClient.get<{ success: boolean; data: KhataAnalyticsResponse }>("/khata/analytics");
        setData(res.data.data);
      }
    } catch {
      setError("Failed to load khata reports");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, isVendor]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch trends data
  const loadTrends = useCallback(async () => {
    setTrendsLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: KhataTrendsResponse }>("/khata/trends/overdue");
      setTrends(res.data.data);
    } catch {
      // Silent fail
    } finally {
      setTrendsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  // ── CSV Export ──────────────────────────────────────────────────────────

  const exportCSV = useCallback(() => {
    if (!data) return;
    const rows: string[][] = [];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const s = data.summary;
    rows.push(["Khata Reports", ""]);
    rows.push(["Generated", new Date().toLocaleString("en-IN")]);
    rows.push([""]);
    rows.push(["Metric", "Value"]);
    rows.push(["Total Accounts", String(s.totalAccounts)]);
    rows.push(["Total Outstanding", String(s.totalOutstanding)]);
    rows.push(["Overdue Accounts", String(s.totalOverdueAccounts)]);
    rows.push(["Utilization Rate", `${s.utilizationRate}%`]);
    if ("avgOutstanding" in s) rows.push(["Avg Outstanding", String(s.avgOutstanding)]);
    if ("collectionRate" in s) rows.push(["Collection Rate", `${(s as KhataReportSummary).collectionRate}%`]);
    rows.push([""]);

    rows.push(["Overdue Accounts"]);
    rows.push(["Farmer", "Phone", "Outstanding", "Days Overdue", "Due Date"]);
    for (const a of data.overdueAccounts) {
      rows.push([esc(a.farmerName), esc(a.farmerPhone), String(a.outstandingAmount), String(a.daysOverdue), a.dueDate ?? "—"]);
    }

    if ("vendorBreakdown" in data && data.vendorBreakdown) {
      rows.push([""]);
      rows.push(["Vendor Breakdown"]);
      rows.push(["Vendor", "Accounts", "Outstanding", "Credit Limit"]);
      for (const v of data.vendorBreakdown) {
        rows.push([esc(v.businessName), String(v.accountCount), String(v.totalOutstanding), String(v.totalCreditLimit)]);
      }
    }

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `khata-reports-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [data]);

  // ── Access check ──────────────────────────────────────────────────────

  if (!user || (user.role !== "VENDOR" && user.role !== "ADMIN")) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <AlertTriangle size={28} className="mx-auto text-gray-300" />
        <h2 className="mt-4 text-lg font-bold text-gray-900">Access Denied</h2>
        <p className="mt-1 text-sm text-gray-500">Only vendors and admins can access khata reports</p>
      </div>
    );
  }

  const summary = data?.summary;
  const sd = data?.statusDistribution;

  // Paginate overdue accounts client-side
  const totalOverduePages = data ? Math.max(1, Math.ceil(data.overdueAccounts.length / overdueLimit)) : 1;
  const pagedOverdue = data?.overdueAccounts.slice(
    (overduePage - 1) * overdueLimit,
    overduePage * overdueLimit
  ) ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: "Khata", href: "/dashboard/khata" },
          { label: "Reports" },
        ]}
      />

      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600">
              <BarChart3 size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Khata Reports</h1>
              <p className="mt-0.5 text-sm text-gray-500">
                {isAdmin ? "Platform-wide khata analytics & overview" : "Your khata portfolio performance"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download size={13} />
              Export CSV
            </button>
          )}
          <button
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-emerald-700" />
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle size={24} className="mx-auto text-red-400" />
          <p className="mt-2 text-sm font-medium text-red-800">{error}</p>
          <button onClick={loadData} className="mt-3 rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {data && !isLoading && (
        <div className="space-y-6">
          {/* Trends Charts */}
          {trends && trends.monthlyDebits.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Debit vs Repayment Chart */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={15} className="text-emerald-600" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Credit vs Repayment (12 months)</h3>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trends.monthlyDebits} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px", color: "#111827" }}
                      formatter={(val) => [`₹${Number(val).toLocaleString("en-IN")}`, ""]}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="debitAmount" name="Credit Given" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="repaymentAmount" name="Repaid" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Outstanding Balance Trend */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={15} className="text-amber-600" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Outstanding Balance Trend</h3>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={trends.outstandingTrend} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px", color: "#111827" }}
                      formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Outstanding"]}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="netOutstanding" name="Outstanding" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Trends loading state */}
          {trendsLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin text-emerald-700" />
            </div>
          )}


          {/* Summary Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Accounts"
              value={String(summary!.totalAccounts)}
              sublabel={`${summary!.totalOverdueAccounts} overdue`}
              icon={BookOpen}
              color="bg-emerald-600"
            />
            <StatCard
              label="Total Outstanding"
              value={formatCompact(summary!.totalOutstanding)}
              sublabel={`of ${formatCompact(summary!.totalCreditLimit)} limit`}
              icon={IndianRupee}
              color="bg-blue-600"
            />
            <StatCard
              label="Utilization Rate"
              value={`${summary!.utilizationRate}%`}
              sublabel="Credit used vs available"
              icon={Percent}
              color="bg-violet-600"
            />
            {"collectionRate" in summary! ? (
              <StatCard
                label="Collection Rate"
                value={`${(summary as KhataReportSummary).collectionRate}%`}
                sublabel={`${formatCompact((summary as KhataReportSummary).totalRepaid)} repaid`}
                icon={TrendingUp}
                color="bg-emerald-600"
              />
            ) : (
              <StatCard
                label="Avg Outstanding"
                value={formatCompact((summary as AdminOverviewResponse["summary"]).avgOutstanding)}
                sublabel="Per account average"
                icon={Users}
                color="bg-amber-600"
              />
            )}
          </div>

          {/* Additional metric cards for VENDOR */}
          {"collectionRate" in summary! && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Total Credit Given</p>
                    <p className="mt-1.5 text-xl font-bold text-gray-900">{formatCompact((summary as KhataReportSummary).totalCreditGiven)}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                    <TrendingDown size={20} className="text-red-600" />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Total Repaid</p>
                    <p className="mt-1.5 text-xl font-bold text-gray-900">{formatCompact((summary as KhataReportSummary).totalRepaid)}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                    <TrendingUp size={20} className="text-emerald-600" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status Distribution */}
          {sd && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-gray-900">Status Distribution</h3>
              <div className="grid gap-2 sm:grid-cols-5">
                {Object.entries(sd).map(([status, count]) => (
                  <StatusBadge key={status} status={status} count={count} />
                ))}
              </div>
              {/* Progress bar */}
              <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-gray-100">
                {Object.entries(sd).map(([status, count]) => {
                  const total = Object.values(sd).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  if (pct === 0) return null;
                  const colors: Record<string, string> = {
                    ACTIVE: "bg-emerald-500",
                    SETTLED: "bg-blue-500",
                    OVERDUE: "bg-red-500",
                    SUSPENDED: "bg-amber-500",
                    WRITTEN_OFF: "bg-gray-400",
                  };
                  return (
                    <div
                      key={status}
                      className={`${colors[status] ?? "bg-gray-300"} transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${status}: ${count} (${pct.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Overdue Accounts */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} className="text-red-600" />
                <h3 className="text-sm font-bold text-gray-900">Overdue Accounts</h3>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {summary!.totalOverdueAccounts} accounts past due{isAdmin ? "" : ` · ${formatCompact((summary as KhataReportSummary).totalOverdueAmount)} total overdue`}
              </p>
            </div>
            {pagedOverdue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <CheckCircle2 size={32} className="mb-2 text-emerald-300" />
                <p className="text-sm font-medium text-gray-500">No overdue accounts</p>
                <p className="text-xs text-gray-400">All accounts are in good standing</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pagedOverdue.map((account) => {
                  const severity = account.daysOverdue > 60 ? "red" : account.daysOverdue > 30 ? "amber" : "orange";
                  const severityColors: Record<string, { bg: string; text: string; dot: string }> = {
                    red: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
                    amber: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
                    orange: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
                  };
                  const sc = severityColors[severity];

                  return (
                    <div key={account.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${sc.bg}`}>
                        <AlertCircle size={16} className={sc.text} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">{account.farmerName}</p>
                        <p className="text-xs text-gray-500">{account.farmerPhone}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-red-600">{formatCompact(account.outstandingAmount)}</p>
                        <p className="text-xs text-gray-400">of {formatCompact(account.creditLimitAmount)}</p>
                      </div>
                      <div className={`rounded-full ${sc.bg} px-2.5 py-1 text-xs font-semibold ${sc.text}`}>
                        {account.daysOverdue}d overdue
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {totalOverduePages > 1 && (
              <div className="flex items-center justify-center gap-2 border-t border-gray-100 px-5 py-3">
                <button
                  onClick={() => setOverduePage((p) => Math.max(1, p - 1))}
                  disabled={overduePage <= 1}
                  className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-gray-500">Page {overduePage} of {totalOverduePages}</span>
                <button
                  onClick={() => setOverduePage((p) => Math.min(totalOverduePages, p + 1))}
                  disabled={overduePage >= totalOverduePages}
                  className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Vendor Breakdown (Admin only) */}
          {"vendorBreakdown" in data && data.vendorBreakdown && data.vendorBreakdown.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-blue-600" />
                  <h3 className="text-sm font-bold text-gray-900">Vendor Breakdown</h3>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">Khata portfolio by vendor</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-5 py-3 font-semibold text-gray-600">Vendor</th>
                      <th className="px-5 py-3 font-semibold text-gray-600">Accounts</th>
                      <th className="px-5 py-3 font-semibold text-gray-600">Outstanding</th>
                      <th className="px-5 py-3 font-semibold text-gray-600">Credit Limit</th>
                      <th className="px-5 py-3 font-semibold text-gray-600">Utilization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.vendorBreakdown.map((v) => (
                      <tr key={v.vendorId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-900">{v.businessName}</td>
                        <td className="px-5 py-3 text-gray-600">{v.accountCount}</td>
                        <td className="px-5 py-3 font-semibold text-gray-900">{formatCompact(v.totalOutstanding)}</td>
                        <td className="px-5 py-3 text-gray-600">{formatCompact(v.totalCreditLimit)}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            v.totalCreditLimit > 0 && v.totalOutstanding / v.totalCreditLimit > 0.8
                              ? "bg-red-50 text-red-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}>
                            {v.totalCreditLimit > 0
                              ? `${Math.round((v.totalOutstanding / v.totalCreditLimit) * 100)}%`
                              : "0%"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
