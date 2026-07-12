"use client";

import { useEffect, useState, useCallback } from "react";
import { useReportStore } from "@/stores/reportStore";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  Package,
  Users,
} from "lucide-react";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const TABS = [
  { key: "sales" as const, label: "Sales Report", icon: BarChart3 },
  { key: "performance" as const, label: "Product Performance", icon: TrendingUp },
  { key: "overdue" as const, label: "Khata Overdue", icon: AlertTriangle },
];

export default function ReportsPage() {
  const { user } = useAuthStore();
  const {
    salesReport, salesSummary, productPerformance, khataOverdue,
    total, page, totalPages, isLoading, activeTab,
    setActiveTab, fetchSalesReport, fetchProductPerformance, fetchKhataOverdue,
  } = useReportStore();

  const [currentPage, setCurrentPage] = useState(1);
  const [minOverdueDays, setMinOverdueDays] = useState(1);

  const isAdmin = user?.role === "ADMIN";

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (activeTab === "sales") {
      fetchSalesReport(currentPage, 20).catch(() => toast.error("Failed to load sales report"));
    } else if (activeTab === "performance") {
      fetchProductPerformance(currentPage, 20).catch(() => toast.error("Failed to load product data"));
    } else if (activeTab === "overdue") {
      fetchKhataOverdue(currentPage, 20, minOverdueDays).catch(() => toast.error("Failed to load overdue report"));
    }
  }, [activeTab, currentPage, minOverdueDays, fetchSalesReport, fetchProductPerformance, fetchKhataOverdue]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const totalPagesNum = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reports & Analytics</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
          {isAdmin ? "Platform-wide analytics and reports" : "Your sales and khata reports"}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-700 p-1">
        {TABS.filter((tab) => tab.key !== "performance" || isAdmin).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-white dark:bg-gray-800 text-emerald-800 dark:text-emerald-300 dark:text-emerald-400 shadow-sm dark:shadow-gray-950/30"
                  : "text-gray-600 dark:text-gray-300 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
        </div>
      ) : (
        <>
          {/* Sales Report Tab */}
          {activeTab === "sales" && (
            <div>
              {/* Summary */}
              {salesSummary && (
                <div className="mb-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                        <IndianRupee size={18} className="text-emerald-700 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">Total Revenue</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(salesSummary.totalAmount)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
                        <Package size={18} className="text-blue-700 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">Orders Delivered</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{salesSummary.totalOrders}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {salesReport.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                  <BarChart3 size={40} className="mb-3 text-gray-300 dark:text-gray-500" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">No sales data yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-500">Order</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-500">Customer</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-500">Items</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-500">Amount</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-500">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {salesReport.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">{order.orderNumber}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{order.user.fullName}</td>
                          <td className="px-4 py-3">
                            <span className="text-gray-600 dark:text-gray-300 dark:text-gray-500">
                              {order.items?.map((i) => i.variant.product.name).join(", ") || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(order.totalAmount)}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatDate(order.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Product Performance Tab */}
          {activeTab === "performance" && (
            <div>
              {productPerformance.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                  <TrendingUp size={40} className="mb-3 text-gray-300 dark:text-gray-500" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">{isAdmin ? "No product data yet" : "No products yet"}</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-500">Product</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-500">Category</th>
                        {isAdmin && <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-500">Vendor</th>}
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-500">Total Sold</th>
                        <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-500">In Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {productPerformance.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{product.name}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 dark:text-gray-500">{product.category?.name || "—"}</td>
                          {isAdmin && <td className="px-4 py-3 text-gray-600 dark:text-gray-300 dark:text-gray-500">{product.vendor?.businessName || "—"}</td>}
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                              {product.totalSold}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              product.inStock > 0 ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                            }`}>
                              {product.inStock}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Khata Overdue Tab */}
          {activeTab === "overdue" && (
            <div>
              {/* Filter */}
              <div className="mb-4 flex items-center gap-3">
                <label className="text-sm font-medium text-gray-600 dark:text-gray-300 dark:text-gray-500">Min overdue days:</label>
                <select
                  value={minOverdueDays}
                  onChange={(e) => { setMinOverdueDays(Number(e.target.value)); setCurrentPage(1); }}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400"
                >
                  <option value={1}>1+ day</option>
                  <option value={7}>7+ days</option>
                  <option value={15}>15+ days</option>
                  <option value={30}>30+ days</option>
                  <option value={60}>60+ days</option>
                  <option value={90}>90+ days</option>
                </select>
              </div>

              {khataOverdue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                  <AlertTriangle size={40} className="mb-3 text-gray-300 dark:text-gray-500" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">No overdue accounts</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">All khata accounts are in good standing</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {khataOverdue.map((account) => (
                    <div key={account.id} className="rounded-xl border border-red-100 bg-white dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={14} className="text-red-500 dark:text-red-400" />
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {account.farmer.user.fullName}
                            </span>
                            <span className="rounded-full bg-red-50 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">
                              {account.status}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                            <span>Vendor: {account.vendor.businessName}</span>
                            <span>Farmer: {account.farmer.user.phoneNumber}</span>
                            {account.dueDateNextPayment && (
                              <span>Due: {formatDate(account.dueDateNextPayment)}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(account.outstandingAmount)}</p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">of {formatCurrency(account.creditLimitAmount)} limit</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPagesNum > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="rounded-lg border border-gray-300 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-40"
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
                    onClick={() => setCurrentPage(p)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold ${
                      p === currentPage ? "bg-emerald-700 dark:bg-emerald-600 text-white" : "text-gray-600 dark:text-gray-300 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPagesNum, p + 1))}
                disabled={currentPage >= totalPagesNum}
                className="rounded-lg border border-gray-300 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
