"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import {
  TrendingUp,
  Search,
  ShoppingBag,
  BarChart3,
  Package,
  Eye,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CalendarDays,
  Download,
  CalendarRange,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatCompact(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}

// ─── Pagination Component ─────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
      <p className="text-xs text-gray-500">{total} total</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          Prev
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const start = Math.max(1, page - 2);
          const p = start + i;
          if (p > totalPages) return null;
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                p === page
                  ? "bg-violet-700 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaginatedList<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface MIResponse {
  summary: { totalSales: number; totalOrders: number; totalProductsViewed: number; totalSearches: number };
  trendingProducts: PaginatedList<{
    id: string; name: string; slug: string; viewCount: number;
    category: { name: string } | null;
    vendor: { businessName: string } | null;
    images: { imageUrl: string }[];
  }>;
  popularSearches: PaginatedList<{ keyword: string; count: number }>;
  categoryPerformance: PaginatedList<{
    categoryId: string; name: string; totalSales: number; totalQty: number; orderCount: number;
  }>;
  topSellingProducts: PaginatedList<{
    variantId: string; productName: string; productSlug: string;
    variantName: string; sku: string; sellingPrice: number;
    categoryName: string; vendorName: string; totalSold: number;
  }>;
  salesTrend: Array<{ date: string; sales: number; orders: number }>;
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

// ─── Recharts Sales Chart ─────────────────────────────────────────────────────

function SalesChart({ data, isDark }: { data: { date: string; sales: number; orders: number }[]; isDark: boolean }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400 italic">
        No sales data available for this period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e5e7eb"} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: isDark ? "#94a3b8" : "#9ca3af" }}
          tickFormatter={(v) => v.slice(5)}
          axisLine={{ stroke: isDark ? "#334155" : "#e5e7eb" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: isDark ? "#94a3b8" : "#9ca3af" }}
          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? "#1e293b" : "#fff",
            border: `1px solid ${isDark ? "#334155" : "#e5e7eb"}`,
            borderRadius: "8px",
            fontSize: "12px",
            color: isDark ? "#e2e8f0" : "#111827",
          }}
          formatter={(value, name) => {
            if (name === "sales") return [formatCompact(Number(value)), "Sales"];
            return [Number(value), "Orders"];
          }}
          labelFormatter={(label) => {
            const d = new Date(label);
            return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
          }}
        />
        <Area
          type="monotone"
          dataKey="sales"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#salesGradient)"
          dot={false}
          activeDot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketIntelligencePage() {
  const { user } = useAuthStore();
  const { theme } = useUiStore();
  const [data, setData] = useState<MIResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "trends" | "categories" | "searches">("all");

  // Per-section pagination state
  const [trendingPage, setTrendingPage] = useState(1);
  const [topSellingPage, setTopSellingPage] = useState(1);
  const [searchesPage, setSearchesPage] = useState(1);
  const [categoriesPage, setCategoriesPage] = useState(1);

  // Date range filter
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ── Refresh on navigation: reset all state on mount ──
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setTrendingPage(1);
    setTopSellingPage(1);
    setSearchesPage(1);
    setCategoriesPage(1);
    setStartDate("");
    setEndDate("");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        trendingPage, trendingLimit: 10,
        topSellingPage, topSellingLimit: 10,
        searchesPage, searchesLimit: 10,
        categoriesPage, categoriesLimit: 10,
      };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await apiClient.get<{ success: boolean; data: MIResponse }>("/reports/market-intelligence", { params });
      setData(res.data.data);
    } catch {
      setError("Failed to load market intelligence data");
    } finally {
      setIsLoading(false);
    }
  }, [trendingPage, topSellingPage, searchesPage, categoriesPage, startDate, endDate]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadData();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadData]);

  // ── CSV Export ────────────────────────────────────────────────────────────

  const exportCSV = useCallback(() => {
    if (!data) return;

    const rows: string[][] = [];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    // Summary section
    rows.push(["Market Intelligence Report", ""]);
    rows.push(["Generated", new Date().toLocaleString("en-IN")]);
    rows.push([""]);
    rows.push(["Metric", "Value"]);
    rows.push(["Total Sales", String(data.summary.totalSales)]);
    rows.push(["Total Orders", String(data.summary.totalOrders)]);
    rows.push(["Products Viewed", String(data.summary.totalProductsViewed)]);
    rows.push(["Total Searches", String(data.summary.totalSearches)]);
    rows.push([""]);

    // Trending Products
    rows.push(["Trending Products"]);
    rows.push(["Rank", "Product", "Category", "Vendor", "Views"]);
    data.trendingProducts.items.forEach((p, i) => {
      rows.push([
        String(i + 1), esc(p.name), esc(p.category?.name ?? ""),
        esc(p.vendor?.businessName ?? ""), String(p.viewCount),
      ]);
    });
    rows.push([""]);

    // Top Selling
    rows.push(["Top Selling Products"]);
    rows.push(["Rank", "Product", "Variant", "SKU", "Vendor", "Units Sold", "Unit Price"]);
    data.topSellingProducts.items.forEach((p, i) => {
      rows.push([
        String(i + 1), esc(p.productName), esc(p.variantName),
        esc(p.sku), esc(p.vendorName), String(p.totalSold),
        String(p.sellingPrice),
      ]);
    });
    rows.push([""]);

    // Category Performance
    rows.push(["Category Performance"]);
    rows.push(["Category", "Sales", "Units", "Orders"]);
    data.categoryPerformance.items.forEach((c) => {
      rows.push([esc(c.name), String(c.totalSales), String(c.totalQty), String(c.orderCount)]);
    });
    rows.push([""]);

    // Popular Searches
    rows.push(["Popular Searches"]);
    rows.push(["Keyword", "Count"]);
    data.popularSearches.items.forEach((s) => {
      rows.push([esc(s.keyword), String(s.count)]);
    });

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `market-intelligence-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [data]);

  if (!user || (user.role !== "VENDOR" && user.role !== "ADMIN")) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <AlertTriangle size={28} className="mx-auto text-gray-300" />
        <h2 className="mt-4 text-lg font-bold text-gray-900">Access Denied</h2>
        <p className="mt-1 text-sm text-gray-500">Only vendors and admins can access market intelligence</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumbs
        className="mb-4"
        items={[
          { label: "Reports", href: "/dashboard/reports" },
          { label: "Market Intelligence" },
        ]}
      />

      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
              <BarChart3 size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Market Intelligence</h1>
              <p className="mt-0.5 text-sm text-gray-500">
                {startDate || endDate
                  ? `${startDate || "Start"} — ${endDate || "End"}`
                  : "Insights, trends & analytics for the last 30 days"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Date Range Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                showDatePicker || startDate
                  ? "border-violet-300 bg-violet-50 text-violet-700"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <CalendarRange size={13} />
              {startDate ? `${startDate.slice(5)}—${endDate?.slice(5) ?? "Now"}` : "Date Range"}
            </button>

            {showDatePicker && (
              <div className="absolute right-0 top-full mt-1 z-20 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
                <p className="mb-3 text-xs font-semibold text-gray-900">Filter by Date</p>
                {/* Preset date filters */}
                  <div className="flex gap-1.5">
                    {[
                      { label: "7d", days: 7 },
                      { label: "30d", days: 30 },
                      { label: "90d", days: 90 },
                      { label: "1yr", days: 365 },
                    ].map((preset) => {
                      const targetDate = new Date();
                      targetDate.setDate(targetDate.getDate() - preset.days);
                      const isActive = startDate === targetDate.toISOString().slice(0, 10) && !endDate;
                      return (
                        <button
                          key={preset.label}
                          onClick={() => {
                            const d = new Date(Date.now() - preset.days * 24 * 60 * 60 * 1000);
                            setStartDate(d.toISOString().slice(0, 10));
                            setEndDate("");
                          }}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                            isActive
                              ? "bg-violet-700 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-2.5">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">Start</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500">End</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs outline-none focus:border-violet-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                        setShowDatePicker(false);
                      }}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className="rounded-lg bg-violet-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-violet-800"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export CSV */}
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
          <Loader2 size={24} className="animate-spin text-violet-600" />
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
          {/* Summary Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Sales"
              value={formatCompact(data.summary.totalSales)}
              sublabel={`${data.summary.totalOrders} orders`}
              icon={ShoppingBag}
              color="bg-emerald-600"
            />
            <StatCard
              label="Trending Products"
              value={String(data.summary.totalProductsViewed)}
              sublabel="Viewed in last 30 days"
              icon={Eye}
              color="bg-blue-600"
            />
            <StatCard
              label="Popular Searches"
              value={String(data.summary.totalSearches)}
              sublabel="Unique search terms"
              icon={Search}
              color="bg-violet-600"
            />
            <StatCard
              label="Avg Order Value"
              value={data.summary.totalOrders > 0 ? formatCurrency(Math.round(data.summary.totalSales / data.summary.totalOrders)) : "—"}
              sublabel={data.summary.totalOrders > 0 ? `${data.summary.totalOrders} orders placed` : "No orders yet"}
              icon={TrendingUp}
              color="bg-amber-600"
            />
          </div>

          {/* Sales Trend Chart */}
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-gray-500 dark:text-gray-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Sales Trend (30 days)</h3>
              </div>
              {data.salesTrend.length > 0 && (
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                    Daily sales
                  </span>
                  <span>
                    Peak: {formatCompact(Math.max(...data.salesTrend.map((d) => d.sales)))}
                  </span>
                </div>
              )}
            </div>
            <SalesChart data={data.salesTrend} isDark={theme === "dark"} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 border-b border-gray-200 pb-3 overflow-x-auto">
            {[
              { key: "all" as const, label: "All Insights" },
              { key: "trends" as const, label: "Trending Products" },
              { key: "categories" as const, label: "Categories" },
              { key: "searches" as const, label: "Search Trends" },
            ].map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    // Reset non-relevant page states when switching tabs
                    if (tab.key !== "trends") { setTrendingPage(1); setTopSellingPage(1); }
                    if (tab.key !== "categories") setCategoriesPage(1);
                    if (tab.key !== "searches") setSearchesPage(1);
                  }}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? "bg-violet-700 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Trending Products */}
            {(activeTab === "all" || activeTab === "trends") && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={15} className="text-blue-600" />
                    <h3 className="text-sm font-bold text-gray-900">Trending Products</h3>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">Most viewed products this month</p>
                </div>
                {data.trendingProducts.items.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-gray-400 italic">No view data yet</div>
                ) : (
                  <>
                    <div className="divide-y divide-gray-100">
                      {data.trendingProducts.items.map((product, idx) => (
                        <div key={product.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                          <span className="w-5 text-xs font-bold text-gray-400">#{(data.trendingProducts.pagination.page - 1) * data.trendingProducts.pagination.limit + idx + 1}</span>
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                            {product.images[0]?.imageUrl ? (
                              <img src={product.images[0].imageUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Package size={16} className="text-gray-300" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link href={`/products/${product.slug}`} className="text-sm font-semibold text-gray-900 hover:text-blue-700 transition-colors line-clamp-1">
                              {product.name}
                            </Link>
                            <p className="text-[11px] text-gray-500">
                              {product.category?.name} · {product.vendor?.businessName}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 text-xs font-semibold text-blue-700">
                            <Eye size={12} />
                            {product.viewCount}
                          </div>
                        </div>
                      ))}
                    </div>
                    {activeTab === "trends" && (
                      <Pagination
                        page={data.trendingProducts.pagination.page}
                        totalPages={data.trendingProducts.pagination.totalPages}
                        total={data.trendingProducts.pagination.total}
                        onChange={(p) => setTrendingPage(p)}
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {/* Top Selling Products */}
            {(activeTab === "all" || activeTab === "trends") && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={15} className="text-emerald-600" />
                    <h3 className="text-sm font-bold text-gray-900">Top Selling</h3>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">Highest quantity sold this month</p>
                </div>
                {data.topSellingProducts.items.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-gray-400 italic">No sales data yet</div>
                ) : (
                  <>
                    <div className="divide-y divide-gray-100">
                      {data.topSellingProducts.items.map((product, idx) => (
                        <div key={product.variantId} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                          <span className="w-5 text-xs font-bold text-gray-400">#{(data.topSellingProducts.pagination.page - 1) * data.topSellingProducts.pagination.limit + idx + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 line-clamp-1">{product.productName}</p>
                            <p className="text-[11px] text-gray-500">
                              {product.variantName} · {product.sku} · {product.vendorName}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-bold text-gray-900">{product.totalSold} sold</p>
                            <p className="text-[10px] text-gray-400">{formatCurrency(product.sellingPrice)}/unit</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {activeTab === "trends" && (
                      <Pagination
                        page={data.topSellingProducts.pagination.page}
                        totalPages={data.topSellingProducts.pagination.totalPages}
                        total={data.topSellingProducts.pagination.total}
                        onChange={(p) => setTopSellingPage(p)}
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {/* Category Performance */}
            {(activeTab === "all" || activeTab === "categories") && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={15} className="text-violet-600" />
                    <h3 className="text-sm font-bold text-gray-900">Category Performance</h3>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">Sales breakdown by category</p>
                </div>
                {data.categoryPerformance.items.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-gray-400 italic">No category data yet</div>
                ) : (
                  <>
                    <div className="divide-y divide-gray-100">
                      {data.categoryPerformance.items.map((cat, idx) => {
                      const pct = data.summary.totalSales > 0
                        ? ((cat.totalSales / data.summary.totalSales) * 100).toFixed(1)
                        : "0";
                      return (
                        <div key={cat.categoryId} className="px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-gray-900">{cat.name}</p>
                            <p className="text-xs font-bold text-gray-900">{formatCompact(cat.totalSales)}</p>
                          </div>
                          {/* Progress bar */}
                          <div className="h-1.5 rounded-full bg-gray-100">
                            <div
                              className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all"
                              style={{ width: `${Math.min(Number(pct), 100)}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-gray-400">{pct}% of total sales</span>
                            <span className="text-[10px] text-gray-400">{cat.totalQty} units · {cat.orderCount} orders</span>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                    {activeTab === "categories" && (
                      <Pagination
                        page={data.categoryPerformance.pagination.page}
                        totalPages={data.categoryPerformance.pagination.totalPages}
                        total={data.categoryPerformance.pagination.total}
                        onChange={(p) => setCategoriesPage(p)}
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {/* Popular Searches */}
            {(activeTab === "all" || activeTab === "searches") && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Search size={15} className="text-amber-600" />
                    <h3 className="text-sm font-bold text-gray-900">Popular Searches</h3>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">What users are searching for</p>
                </div>
                {data.popularSearches.items.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-gray-400 italic">No search data yet</div>
                ) : (
                  <>
                    <div className="divide-y divide-gray-100">
                      {data.popularSearches.items.map((search, idx) => {
                        const maxCount = data.popularSearches.items[0]?.count ?? 1;
                      const barWidth = (search.count / maxCount) * 100;
                      return (
                        <div key={search.keyword} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50/50 transition-colors">
                          <span className="w-5 text-xs font-bold text-gray-400">#{idx + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">{search.keyword}</p>
                            <div className="mt-1 h-1.5 rounded-full bg-amber-50">
                              <div className="h-1.5 rounded-full bg-amber-500 transition-all" style={{ width: `${barWidth}%` }} />
                            </div>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-gray-700">{search.count}</span>
                        </div>
                      );
                    })}
                    </div>
                    {activeTab === "searches" && (
                      <Pagination
                        page={data.popularSearches.pagination.page}
                        totalPages={data.popularSearches.pagination.totalPages}
                        total={data.popularSearches.pagination.total}
                        onChange={(p) => setSearchesPage(p)}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
