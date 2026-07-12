"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminStore } from "@/stores/adminStore";
import { toast } from "sonner";
import {
  ShieldCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Package,
  Eye,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import type { ProductListItem } from "@/types/auth";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

const STATUS_TABS = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "OUT_OF_STOCK", label: "Out of Stock" },
  { value: "DISCONTINUED", label: "Discontinued" },
];

export default function ProductModerationPage() {
  const { moderationProducts, moderationTotal, moderationPage, moderationTotalPages, isModerationLoading, isModerating, fetchProductsForModeration, moderateProduct } = useAdminStore();
  const [statusFilter, setStatusFilter] = useState("DRAFT");
  const [page, setPage] = useState(1);
  const [modalProduct, setModalProduct] = useState<ProductListItem | null>(null);
  const [modNote, setModNote] = useState("");

  useEffect(() => {
    fetchProductsForModeration(page, 20, statusFilter).catch(() => toast.error("Failed to load products"));
  }, [page, statusFilter, fetchProductsForModeration]);

  const handleModerate = async (id: string, status: string) => {
    try {
      await moderateProduct(id, status, modNote || undefined);
      toast.success(`Product ${status === "APPROVED" ? "approved" : "rejected"}`);
      setModalProduct(null);
      setModNote("");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to moderate");
    }
  };

  const totalPagesNum = Math.ceil(moderationTotal / 20);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Product Moderation</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Review and manage product listings</p>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {STATUS_TABS.map(tab => (
          <button key={tab.value} onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === tab.value ? "bg-emerald-700 text-white shadow-sm dark:shadow-gray-950/30" : "bg-white dark:bg-gray-800 dark:bg-gray-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 border border-gray-200 dark:border-gray-700 dark:border-gray-700"
            }`}>{tab.label}</button>
        ))}
      </div>

      {isModerationLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" /></div>
      ) : moderationProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30"><ShieldCheck size={36} className="text-emerald-300" /></div>
          <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">No products to review</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">All products have been moderated</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{moderationTotal} product{moderationTotal !== 1 ? "s" : ""}</p>
          <div className="space-y-3">
            {moderationProducts.map(p => (
              <div key={p.id} className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
                      {p.images[0]?.imageUrl ? <img src={p.images[0].imageUrl} alt="" className="h-full w-full rounded-lg object-cover" />
                        : <Package size={18} className="text-gray-300" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{p.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{p.vendor.businessName} · {p.category.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-700 dark:text-gray-200 dark:text-gray-200">{p.status}</span>
                        {p.variants.length > 0 && <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{p.variants.length} variant{p.variants.length > 1 ? "s" : ""} · from {formatCurrency(Math.min(...p.variants.map(v => v.sellingPrice)))}</span>}
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatDate(p.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setModalProduct(p)} className="shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 p-2 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400">
                    <Eye size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPagesNum > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1} className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"><ChevronLeft size={16} /></button>
              {Array.from({ length: Math.min(totalPagesNum, 5) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPagesNum - 4));
                const p = start + i;
                if (p > totalPagesNum) return null;
                return <button key={p} onClick={() => setPage(p)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold ${p === page ? "bg-emerald-700 text-white" : "text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"}`}>{p}</button>;
              })}
              <button onClick={() => setPage(p => Math.min(totalPagesNum, p+1))} disabled={page >= totalPagesNum} className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          )}
        </>
      )}

      {/* Moderation Modal */}
      {modalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{modalProduct.name}</h3>
              <div className="flex items-center gap-1">
                {statusFilter !== "ACTIVE" && (
                  <>
                    <button onClick={() => handleModerate(modalProduct.id, "APPROVED")} disabled={isModerating}
                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                      {isModerating ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />} Approve
                    </button>
                    <button onClick={() => handleModerate(modalProduct.id, "REJECTED")} disabled={isModerating}
                      className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                      <ThumbsDown size={12} /> Reject
                    </button>
                  </>
                )}
                <button onClick={() => { setModalProduct(null); setModNote(""); }} className="rounded-lg p-1 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"><XCircle size={18} /></button>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Vendor</span><span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{modalProduct.vendor.businessName}</span></div>
              <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Category</span><span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{modalProduct.category.name}</span></div>
              <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Status</span><span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{modalProduct.status}</span></div>
              {modalProduct.description && <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><p className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300 mb-1">Description</p><p className="text-gray-900 dark:text-gray-100 dark:text-gray-100">{modalProduct.description}</p></div>}
              <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Variants</span><span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{modalProduct.variants.length}</span></div>
              <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Seasonal</span><span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{modalProduct.seasonalFlag ? "Yes" : "No"}</span></div>
              {modalProduct.applicableCrops.length > 0 && (
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><p className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300 mb-1">Crops</p><div className="flex flex-wrap gap-1">{modalProduct.applicableCrops.map(c => <span key={c} className="rounded-full bg-gray-200 dark:bg-gray-600 dark:bg-gray-600 px-2 py-0.5 text-[10px] text-gray-700 dark:text-gray-200 dark:text-gray-200">{c}</span>)}</div></div>
              )}
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Moderation Note</label>
              <textarea value={modNote} onChange={e => setModNote(e.target.value)} rows={2} placeholder="Optional note..."
                className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
