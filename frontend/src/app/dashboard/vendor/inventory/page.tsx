"use client";

import { useEffect, useState } from "react";
import { useVendorStore } from "@/stores/vendorStore";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import {
  Package,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Minus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  X,
} from "lucide-react";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function InventoryPage() {
  const { user } = useAuthStore();
  const {
    lowStockItems, inventoryLogs, inventoryLogsTotal, inventoryLogsPage, inventoryLogsTotalPages,
    isInventoryLoading, isAdjusting,
    fetchLowStock, fetchInventoryLogs, adjustInventory,
  } = useVendorStore();

  const [tab, setTab] = useState<"low-stock" | "logs">("low-stock");
  const [logsPage, setLogsPage] = useState(1);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustVariantId, setAdjustVariantId] = useState("");
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState("ADJUSTMENT");

  useEffect(() => {
    fetchLowStock().catch(() => toast.error("Failed to load low stock items"));
  }, [fetchLowStock]);

  useEffect(() => {
    if (tab === "logs") {
      fetchInventoryLogs(logsPage, 20).catch(() => toast.error("Failed to load inventory logs"));
    }
  }, [tab, logsPage, fetchInventoryLogs]);

  const handleAdjust = async () => {
    if (!adjustVariantId || adjustQty === 0) return;
    try {
      await adjustInventory(adjustVariantId, adjustQty, adjustReason);
      toast.success("Inventory adjusted");
      setShowAdjustForm(false);
      setAdjustVariantId("");
      setAdjustQty(0);
      fetchLowStock().catch(() => {});
    } catch {
      toast.error("Failed to adjust inventory");
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Inventory</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Manage stock levels and view inventory history</p>
        </div>
        <button
          onClick={() => setShowAdjustForm(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-800"
        >
          <Plus size={16} />
          Adjust Stock
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setTab("low-stock")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
            tab === "low-stock" ? "bg-emerald-700 text-white shadow-sm dark:shadow-gray-950/30" : "bg-white dark:bg-gray-800 dark:bg-gray-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 border border-gray-200 dark:border-gray-700 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 dark:border-gray-600"
          }`}
        >
          <AlertTriangle size={14} className="inline mr-1.5" />
          Low Stock ({lowStockItems.length})
        </button>
        <button
          onClick={() => setTab("logs")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
            tab === "logs" ? "bg-emerald-700 text-white shadow-sm dark:shadow-gray-950/30" : "bg-white dark:bg-gray-800 dark:bg-gray-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 border border-gray-200 dark:border-gray-700 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 dark:border-gray-600"
          }`}
        >
          <ClipboardList size={14} className="inline mr-1.5" />
          Inventory Logs
        </button>
      </div>

      {tab === "low-stock" && (
        <>
          {isInventoryLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" /></div>
          ) : lowStockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30">
                <Package size={36} className="text-emerald-300" />
              </div>
              <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">All stocked up!</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">No items are below their reorder threshold</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-950/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{item.product.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{item.variantName ?? "Default"} · SKU: {item.sku}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="rounded-full bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
                        Stock: {item.stockQuantity}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Threshold: {item.reorderThreshold}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatCurrency(item.sellingPrice)} each</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setAdjustVariantId(item.id);
                      setAdjustQty(item.reorderThreshold * 2 - item.stockQuantity);
                      setShowAdjustForm(true);
                    }}
                    className="shrink-0 rounded-lg border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30"
                  >
                    Restock
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "logs" && (
        <>
          {isInventoryLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" /></div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-left">Change</th>
                    <th className="px-4 py-3 text-left">After</th>
                    <th className="px-4 py-3 text-left">Reason</th>
                    <th className="px-4 py-3 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 dark:divide-gray-700">
                  {inventoryLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{log.variant?.product.name ?? "—"}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{log.variant?.variantName ?? "Default"} · {log.variant?.sku}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 font-semibold ${log.quantityChange > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                          {log.quantityChange > 0 ? <Plus size={12} /> : <Minus size={12} />}
                          {Math.abs(log.quantityChange)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200 dark:text-gray-200">{log.quantityAfter}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:text-gray-200 dark:text-gray-200">
                          {log.reason}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatDate(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {inventoryLogsTotalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button onClick={() => setLogsPage(p => Math.max(1, p-1))} disabled={logsPage <= 1}
                className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"><ChevronLeft size={16} /></button>
              <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Page {logsPage} of {inventoryLogsTotalPages}</span>
              <button onClick={() => setLogsPage(p => Math.min(inventoryLogsTotalPages, p+1))} disabled={logsPage >= inventoryLogsTotalPages}
                className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          )}
        </>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Adjust Stock</h3>
              <button onClick={() => setShowAdjustForm(false)} className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Variant ID</label>
                <input value={adjustVariantId} onChange={e => setAdjustVariantId(e.target.value)}
                  placeholder="Enter variant ID"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Quantity Change</label>
                <input type="number" value={adjustQty} onChange={e => setAdjustQty(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20" />
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Use positive for restock, negative for reduction</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Reason</label>
                <select value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20">
                  <option value="RESTOCK">Restock</option>
                  <option value="SALE">Sale</option>
                  <option value="RETURN">Return</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                  <option value="DAMAGED">Damaged</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowAdjustForm(false)}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50">Cancel</button>
                <button onClick={handleAdjust} disabled={!adjustVariantId || adjustQty === 0 || isAdjusting}
                  className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-800 disabled:opacity-50">
                  {isAdjusting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Adjust
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
