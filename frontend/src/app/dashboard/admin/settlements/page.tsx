"use client";

import { useEffect, useState, useCallback } from "react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import {
  Landmark,
  Loader2,
  Plus,
  CheckCircle2,
  Clock,
  Ban,
  X,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  Banknote,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Settlement {
  id: string;
  vendorId: string;
  periodStart: string;
  periodEnd: string;
  totalSales: number;
  commissionAmount: number;
  tdsDeducted: number;
  payableAmount: number;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED";
  utrNumber: string | null;
  settledAt: string | null;
  createdAt: string;
  vendor?: { businessName: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  PENDING: { bg: "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", icon: Clock },
  PROCESSING: { bg: "bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", icon: Loader2 },
  PAID: { bg: "bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300", icon: CheckCircle2 },
  FAILED: { bg: "bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30", text: "text-red-800", icon: Ban },
};

// ─── Generate Settlement Modal ────────────────────────────────────────────────

function GenerateSettlementModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [vendorId, setVendorId] = useState("");
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) { setError("Vendor ID is required"); return; }
    if (!periodStart || !periodEnd) { setError("Period dates are required"); return; }
    if (new Date(periodEnd) <= new Date(periodStart)) { setError("Period end must be after period start"); return; }

    setIsGenerating(true);
    setError("");
    try {
      await apiClient.post("/settlements/generate", {
        vendorId,
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
      });
      toast.success("Settlement generated successfully");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message ?? "Failed to generate settlement");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
              <Plus size={20} className="text-emerald-700 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Generate Settlement</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Vendor ID *</label>
            <input
              type="text"
              value={vendorId}
              onChange={(e) => { setVendorId(e.target.value); setError(""); }}
              placeholder="Enter vendor UUID"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20 font-mono"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Enter the vendor&apos;s UUID (e.g., from vendor management)</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Period Start *</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Period End *</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30 px-4 py-3">
              <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isGenerating || !vendorId}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50 transition-all">
              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {isGenerating ? "Generating..." : "Generate Settlement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Mark Paid Modal ──────────────────────────────────────────────────────────

function MarkPaidModal({ settlement, onClose, onSuccess }: {
  settlement: Settlement;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [utrNumber, setUtrNumber] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrNumber.trim()) { setError("UTR number is required"); return; }

    setIsPaying(true);
    setError("");
    try {
      await apiClient.post(`/settlements/${settlement.id}/pay`, { utrNumber: utrNumber.trim() });
      toast.success("Settlement marked as paid");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message ?? "Failed to mark settlement as paid");
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Mark Settlement Paid</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300">
            <X size={18} />
          </button>
        </div>

        <div className="mb-6 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 p-4">
          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Payable Amount</p>
          <p className="text-xl font-bold text-emerald-900">{formatCurrency(settlement.payableAmount)}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-emerald-700 dark:text-emerald-400">
            <span>Sales: {formatCurrency(settlement.totalSales)}</span>
            <span>Commission: {formatCurrency(settlement.commissionAmount)}</span>
            <span>TDS (1%): {formatCurrency(settlement.tdsDeducted)}</span>
            <span>Period: {formatDate(settlement.periodStart)} - {formatDate(settlement.periodEnd)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">UTR Number *</label>
            <input
              type="text"
              value={utrNumber}
              onChange={(e) => { setUtrNumber(e.target.value); setError(""); }}
              placeholder="e.g. HDFC1234567890"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20 font-mono"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Bank transfer reference number</p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30 px-4 py-3">
              <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isPaying || !utrNumber.trim()}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50 transition-all">
              {isPaying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {isPaying ? "Processing..." : "Mark as Paid"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [payingSettlement, setPayingSettlement] = useState<Settlement | null>(null);

  const loadSettlements = useCallback(async (p: number, status?: string) => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, limit: 20 };
      if (status) params.status = status;

      const res = await apiClient.get<{
        success: boolean;
        data: Settlement[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/settlements", { params });
      setSettlements(res.data.data);
      setTotal(res.data.pagination.total);
      setPage(res.data.pagination.page);
      setTotalPages(res.data.pagination.totalPages);
    } catch {
      toast.error("Failed to load settlements");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadSettlements(1);
  }, [loadSettlements]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handlePageChange = (p: number) => {
    if (p < 1 || p > totalPages) return;
    loadSettlements(p);
  };

  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
              <Landmark size={24} className="text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Vendor Settlements</h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Manage vendor payout cycles, generate settlements, and track payments
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-800 transition-all"
          >
            <Plus size={16} />
            Generate Settlement
          </button>
        </div>

        {/* Summary stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-950/30">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Total Settlements</p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{total}</p>
          </div>
          {["PENDING", "PROCESSING", "PAID"].map((status) => {
            const count = settlements.filter((s) => s.status === status).length;
            return (
              <div key={status} className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-950/30">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{status}</p>
                <p className={`mt-1 text-xl font-bold ${
                  status === "PAID" ? "text-emerald-700 dark:text-emerald-400" : status === "PENDING" ? "text-amber-700 dark:text-amber-400" : "text-blue-700 dark:text-blue-400"
                }`}>
                  {count}
                </p>
              </div>
            );
          })}
        </div>

        {/* Settlements table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
          </div>
        ) : settlements.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
              <Banknote size={28} className="text-gray-300" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">No settlements yet</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Generate a settlement to pay vendors for their sales
            </p>
            <button
              onClick={() => setShowGenerate(true)}
              className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-800 transition-all"
            >
              <Plus size={16} />
              Generate First Settlement
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-300">Vendor</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-300">Period</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-300">Sales</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-300">Commission</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-300">TDS (1%)</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-300">Payable</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-300">Status</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-300">UTR</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 dark:divide-gray-700">
                  {settlements.map((s) => {
                    const style = STATUS_STYLES[s.status];
                    const StatusIcon = style?.icon ?? Clock;
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50/50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{s.vendor?.businessName ?? "—"}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatDate(s.periodStart)}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">to {formatDate(s.periodEnd)}</p>
                        </td>
                        <td className="px-5 py-4 font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(s.totalSales)}</td>
                        <td className="px-5 py-4 text-gray-700 dark:text-gray-200 dark:text-gray-200">{formatCurrency(s.commissionAmount)}</td>
                        <td className="px-5 py-4 text-gray-700 dark:text-gray-200 dark:text-gray-200">{formatCurrency(s.tdsDeducted)}</td>
                        <td className="px-5 py-4">
                          <span className="font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(s.payableAmount)}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style?.bg} ${style?.text}`}>
                            <StatusIcon size={11} />
                            {s.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {s.utrNumber ? (
                            <span className="font-mono text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">{s.utrNumber}</span>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {s.status === "PENDING" && (
                            <button
                              onClick={() => setPayingSettlement(s)}
                              className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition-colors"
                            >
                              <CheckCircle2 size={12} />
                              Mark Paid
                            </button>
                          )}
                          {s.status === "PAID" && s.utrNumber && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              Paid
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 dark:border-gray-700 px-5 py-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Page {page} of {totalPages}</p>
                <div className="flex gap-1">
                  <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-1.5 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40 transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-1.5 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40 transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showGenerate && (
        <GenerateSettlementModal
          onClose={() => setShowGenerate(false)}
          onSuccess={() => loadSettlements(page)}
        />
      )}

      {payingSettlement && (
        <MarkPaidModal
          settlement={payingSettlement}
          onClose={() => setPayingSettlement(null)}
          onSuccess={() => loadSettlements(page)}
        />
      )}
    </RoleGuard>
  );
}
