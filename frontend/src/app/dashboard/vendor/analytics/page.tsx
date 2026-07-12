"use client";

import { useEffect, useState } from "react";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useReportStore } from "@/stores/reportStore";
import { toast } from "sonner";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  TrendingUp, ShoppingBag, Banknote, Package,
  Loader2, RefreshCw, AlertTriangle,
} from "lucide-react";

const COLORS = ["#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0"];

function formatCurrency(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "emerald",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {sub && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30">
          <Icon size={20} className="text-emerald-700 dark:text-emerald-400" />
        </div>
      </div>
    </div>
  );
}

export default function VendorAnalyticsPage() {
  const { vendorData, isLoading: dashLoading, fetchVendorDashboard } = useDashboardStore();
  const { productPerformance, isLoading: repLoading, fetchProductPerformance } = useReportStore();
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");

  const isLoading = dashLoading || repLoading;

  useEffect(() => {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    Promise.all([
      fetchVendorDashboard(),
      fetchProductPerformance(1, 10, { startDate }),
    ]).catch(() => toast.error("Failed to load analytics"));
  }, [range, fetchVendorDashboard, fetchProductPerformance]);

  // Build chart data from top products
  const topProductsChart = (vendorData?.topProducts ?? []).map((p) => ({
    name: p.productName.length > 14 ? p.productName.slice(0, 14) + "…" : p.productName,
    sold: p.totalSold,
  }));

  // Build pie data from commissions
  const commissionPieData = vendorData
    ? [
        { name: "Net Payout", value: vendorData.commissions.totalNetAmount },
        { name: "Commission", value: vendorData.commissions.totalCommissionAmount },
      ]
    : [];

  // Build performance data for bar chart
  const perfChart = productPerformance.slice(0, 8).map((p) => ({
    name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name,
    inStock: p.inStock,
    sold: p.totalSold,
  }));

  // Build khata chart
  const khataData = vendorData
    ? [
        { name: "Outstanding", value: vendorData.khataSummary.totalOutstanding },
        { name: "Credit Limit", value: vendorData.khataSummary.totalCreditLimit },
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Analytics</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Store performance overview</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date range */}
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-sm">
            {(["7d", "30d", "90d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-2 font-semibold transition-colors ${
                  range === r
                    ? "bg-emerald-700 text-white"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
              const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0];
              Promise.all([
                fetchVendorDashboard(),
                fetchProductPerformance(1, 10, { startDate }),
              ]).catch(() => toast.error("Refresh failed"));
            }}
            className="rounded-lg border border-gray-300 dark:border-gray-600 p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {isLoading && !vendorData ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-emerald-700 dark:text-emerald-400" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Sales"
              value={formatCurrency(vendorData?.totalSales ?? 0)}
              icon={TrendingUp}
            />
            <StatCard
              label="Total Orders"
              value={(vendorData?.totalOrders ?? 0).toLocaleString()}
              icon={ShoppingBag}
            />
            <StatCard
              label="Net Payout"
              value={formatCurrency(vendorData?.commissions.totalNetAmount ?? 0)}
              sub={`After ${formatCurrency(vendorData?.commissions.totalCommissionAmount ?? 0)} commission`}
              icon={Banknote}
            />
            <StatCard
              label="Khata Outstanding"
              value={formatCurrency(vendorData?.khataSummary.totalOutstanding ?? 0)}
              sub={`${vendorData?.khataSummary.overdueAccounts ?? 0} overdue accounts`}
              icon={Package}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Selling Products */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-gray-100">
                Top Selling Products
              </h3>
              {topProductsChart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
                  <AlertTriangle size={24} className="mb-2" />
                  <p className="text-sm">No sales data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topProductsChart} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="sold" fill="#059669" radius={[4, 4, 0, 0]} name="Units Sold" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Commission Breakdown */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-gray-100">
                Revenue Breakdown
              </h3>
              {commissionPieData.every((d) => d.value === 0) ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
                  <AlertTriangle size={24} className="mb-2" />
                  <p className="text-sm">No commission data</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={commissionPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {commissionPieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Product Inventory vs Sold */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-gray-100">
                Inventory vs Sold (Top Products)
              </h3>
              {perfChart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
                  <AlertTriangle size={24} className="mb-2" />
                  <p className="text-sm">No product data</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={perfChart} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={10} />
                    <Bar dataKey="inStock" fill="#059669" name="In Stock" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sold" fill="#34d399" name="Total Sold" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Khata Summary */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-gray-100">
                KhataBook Summary
              </h3>
              {khataData.every((d) => d.value === 0) ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
                  <AlertTriangle size={24} className="mb-2" />
                  <p className="text-sm">No khata data</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={khataData} layout="vertical" margin={{ left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatCurrency} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                      <Tooltip
                        formatter={(v: number) => formatCurrency(v)}
                        contentStyle={{ borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="value" fill="#059669" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Active Accounts</p>
                      <p className="font-bold text-gray-900 dark:text-gray-100">
                        {vendorData?.khataSummary.activeAccounts ?? 0}
                      </p>
                    </div>
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">
                      <p className="text-xs text-red-500 dark:text-red-400">Overdue</p>
                      <p className="font-bold text-red-700 dark:text-red-400">
                        {vendorData?.khataSummary.overdueAccounts ?? 0}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
