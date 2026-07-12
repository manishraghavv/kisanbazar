"use client";

import { useEffect, useState, useCallback } from "react";
import { useCouponStore } from "@/stores/couponStore";
import { toast } from "sonner";
import {
  Tag,
  Loader2,
  Plus,
  Edit3,
  Trash2,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  XCircle,
} from "lucide-react";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const TYPE_LABELS: Record<string, string> = { PERCENTAGE: "% Off", FIXED: "Fixed ₹", FREE_DELIVERY: "Free Delivery" };

export default function AdminCouponsPage() {
  const { coupons, total, page, totalPages, isLoading, isSaving, fetchCoupons, createCoupon, updateCoupon, deleteCoupon } = useCouponStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"PERCENTAGE" | "FIXED" | "FREE_DELIVERY">("PERCENTAGE");
  const [value, setValue] = useState(0);
  const [minimumAmount, setMinimumAmount] = useState(0);
  const [maximumDiscount, setMaximumDiscount] = useState(0);
  const [usageLimit, setUsageLimit] = useState(0);
  const [perUserLimit, setPerUserLimit] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    fetchCoupons(currentPage, 20).catch(() => toast.error("Failed to load coupons"));
  }, [currentPage, fetchCoupons]);

  const openCreate = () => {
    setEditId(null);
    setCode(""); setTitle(""); setType("PERCENTAGE"); setValue(0);
    setMinimumAmount(0); setMaximumDiscount(0); setUsageLimit(0); setPerUserLimit(1);
    setIsActive(true);
    const now = new Date();
    const future = new Date(now.getTime() + 30 * 86400000);
    setStartsAt(now.toISOString().slice(0, 16));
    setExpiresAt(future.toISOString().slice(0, 16));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!code.trim() || !title.trim() || !startsAt || !expiresAt) {
      toast.error("Please fill all required fields");
      return;
    }
    try {
      const data = {
        code: code.trim().toUpperCase(),
        title: title.trim(),
        type,
        value,
        minimumAmount: minimumAmount || undefined,
        maximumDiscount: maximumDiscount || undefined,
        usageLimit: usageLimit || undefined,
        perUserLimit,
        isActive,
        startsAt: new Date(startsAt).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
      };

      if (editId) {
        await updateCoupon(editId, data);
        toast.success("Coupon updated");
      } else {
        await createCoupon(data as any);
        toast.success("Coupon created");
      }
      setShowModal(false);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to save coupon");
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    try { await deleteCoupon(showDeleteConfirm); toast.success("Coupon deleted"); setShowDeleteConfirm(null); }
    catch { toast.error("Failed to delete coupon"); }
  };

  const totalPagesNum = Math.ceil(total / 20);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Coupons</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{total} coupon{total !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-800">
          <Plus size={16} />New Coupon
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" /></div>
      ) : coupons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30"><Tag size={36} className="text-emerald-300" /></div>
          <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">No coupons yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Create your first promotional coupon</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {coupons.map(c => (
              <div key={c.id} className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 font-mono text-xs font-bold text-emerald-800 dark:text-emerald-300">{c.code}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{c.title}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${c.isActive ? "bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500"}`}>
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      <span className="font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{TYPE_LABELS[c.type]}{c.type !== "FREE_DELIVERY" ? ` ${c.type === "PERCENTAGE" ? c.value + "%" : "₹" + c.value}` : ""}</span>
                      {c.minimumAmount && <span>Min: ₹{c.minimumAmount}</span>}
                      {c.maximumDiscount && <span>Max disc: ₹{c.maximumDiscount}</span>}
                      <span>{formatDate(c.startsAt)} → {formatDate(c.expiresAt)}</span>
                      <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Used: {c.usageLimit ?? "∞"}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => {
                      setEditId(c.id); setCode(c.code); setTitle(c.title); setType(c.type);
                      setValue(c.value); setMinimumAmount(c.minimumAmount ?? 0); setMaximumDiscount(c.maximumDiscount ?? 0);
                      setUsageLimit(c.usageLimit ?? 0); setPerUserLimit(c.perUserLimit); setIsActive(c.isActive);
                      setStartsAt(new Date(c.startsAt).toISOString().slice(0, 16));
                      setExpiresAt(new Date(c.expiresAt).toISOString().slice(0, 16));
                      setShowModal(true);
                    }} className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-blue-50 dark:bg-blue-900/30 hover:text-blue-700"><Edit3 size={14} /></button>
                    <button onClick={() => setShowDeleteConfirm(c.id)} className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPagesNum > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage <= 1}
                className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"><ChevronLeft size={16} /></button>
              {Array.from({ length: Math.min(totalPagesNum, 5) }, (_, i) => {
                const start = Math.max(1, Math.min(currentPage - 2, totalPagesNum - 4));
                const p = start + i;
                if (p > totalPagesNum) return null;
                return <button key={p} onClick={() => setCurrentPage(p)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold ${p === currentPage ? "bg-emerald-700 text-white" : "text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"}`}>{p}</button>;
              })}
              <button onClick={() => setCurrentPage(p => Math.min(totalPagesNum, p+1))} disabled={currentPage >= totalPagesNum}
                className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{editId ? "Edit Coupon" : "New Coupon"}</h3>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Code *</label>
                  <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="SUMMER25"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm font-mono outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Type</label>
                  <select value={type} onChange={e => setType(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400">
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed (₹)</option>
                    <option value="FREE_DELIVERY">Free Delivery</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Title *</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400" />
              </div>
              {type !== "FREE_DELIVERY" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Value *</label>
                    <input type="number" value={value} onChange={e => setValue(Number(e.target.value))}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Max Discount (₹)</label>
                    <input type="number" value={maximumDiscount} onChange={e => setMaximumDiscount(Number(e.target.value))}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Min Order (₹)</label>
                  <input type="number" value={minimumAmount} onChange={e => setMinimumAmount(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Usage Limit</label>
                  <input type="number" value={usageLimit} onChange={e => setUsageLimit(Number(e.target.value))} placeholder="Unlimited"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Starts At *</label>
                  <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Expires At *</label>
                  <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 dark:border-gray-600 text-emerald-700 dark:text-emerald-400 focus:ring-emerald-500" />
                <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-200 dark:text-gray-200">Active</label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50">Cancel</button>
                <button onClick={handleSave} disabled={!code.trim() || !title.trim() || !startsAt || !expiresAt || isSaving}
                  className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-800 disabled:opacity-50">
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {editId ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30"><Trash2 size={24} className="text-red-600 dark:text-red-400" /></div>
            <h3 className="text-center text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Delete Coupon?</h3>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">This action cannot be undone.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50">Cancel</button>
              <button onClick={handleDelete} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"><Trash2 size={16} />Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
