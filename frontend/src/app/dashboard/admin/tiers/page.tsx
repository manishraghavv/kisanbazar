"use client";

import { useEffect, useState, useCallback } from "react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import {
  Layers,
  Loader2,
  Plus,
  X,
  Save,
  Pencil,
  CheckCircle2,
  IndianRupee,
  Percent,
  BookOpen,
  TrendingUp,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EnterpriseTier {
  id: string;
  name: string;
  size: "MICRO" | "SMALL" | "MEDIUM" | "LARGE" | "ENTERPRISE";
  minAnnualRevenue: number | null;
  maxAnnualRevenue: number | null;
  defaultCommissionRate: number | null;
  maxKhataLimit: number | null;
  description: string | null;
  createdAt: string;
  _count?: { vendors: number };
}

const TIER_SIZES = ["MICRO", "SMALL", "MEDIUM", "LARGE", "ENTERPRISE"] as const;

const TIER_COLORS: Record<string, string> = {
  MICRO:      "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600",
  SMALL:      "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  MEDIUM:     "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  LARGE:      "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  ENTERPRISE: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
};

const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20";

function formatCurrency(amount: number | null) {
  if (amount === null) return "—";
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function TierFormModal({
  tier,
  onClose,
  onSuccess,
}: {
  tier?: EnterpriseTier | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(tier?.name ?? "");
  const [size, setSize] = useState<string>(tier?.size ?? "SMALL");
  const [minRevenue, setMinRevenue] = useState(tier?.minAnnualRevenue ? String(tier.minAnnualRevenue) : "");
  const [maxRevenue, setMaxRevenue] = useState(tier?.maxAnnualRevenue ? String(tier.maxAnnualRevenue) : "");
  const [commissionRate, setCommissionRate] = useState(tier?.defaultCommissionRate ? String(tier.defaultCommissionRate) : "");
  const [maxKhataLimit, setMaxKhataLimit] = useState(tier?.maxKhataLimit ? String(tier.maxKhataLimit) : "");
  const [description, setDescription] = useState(tier?.description ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const isEditing = !!tier;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setIsSaving(true);
    setError("");
    const payload: Record<string, unknown> = {
      name: name.trim(),
      size,
      ...(minRevenue ? { minAnnualRevenue: Number(minRevenue) } : {}),
      ...(maxRevenue ? { maxAnnualRevenue: Number(maxRevenue) } : {}),
      ...(commissionRate ? { defaultCommissionRate: Number(commissionRate) } : {}),
      ...(maxKhataLimit ? { maxKhataLimit: Number(maxKhataLimit) } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
    };
    try {
      if (isEditing) {
        await apiClient.put(`/enterprise-tiers/${tier.id}`, payload);
        toast.success("Tier updated");
      } else {
        await apiClient.post("/enterprise-tiers", payload);
        toast.success("Tier created");
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? (isEditing ? "Failed to update" : "Failed to create"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
              {isEditing
                ? <Pencil size={18} className="text-emerald-700 dark:text-emerald-400" />
                : <Plus size={18} className="text-emerald-700 dark:text-emerald-400" />}
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {isEditing ? "Edit Tier" : "Create Tier"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Name *
              </label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Size *
              </label>
              <select value={size} onChange={(e) => setSize(e.target.value)} className={inputCls}>
                {TIER_SIZES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Min Annual Revenue
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">₹</span>
                <input
                  type="number" min="0" value={minRevenue}
                  onChange={(e) => setMinRevenue(e.target.value)}
                  className={`${inputCls} pl-7`}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Max Annual Revenue
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">₹</span>
                <input
                  type="number" min="0" value={maxRevenue}
                  onChange={(e) => setMaxRevenue(e.target.value)}
                  className={`${inputCls} pl-7`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Commission Rate (%)
              </label>
              <input
                type="number" step="0.1" min="0" max="100"
                value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Max Khata Limit
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">₹</span>
                <input
                  type="number" min="0" value={maxKhataLimit}
                  onChange={(e) => setMaxKhataLimit(e.target.value)}
                  className={`${inputCls} pl-7`}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Description
            </label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              rows={2} className={`${inputCls} resize-none`}
            />
          </div>

          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={isSaving || !name.trim()}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isSaving ? "Saving..." : isEditing ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminTiersPage() {
  const [tiers, setTiers] = useState<EnterpriseTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTier, setEditingTier] = useState<EnterpriseTier | null>(null);
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

  const loadTiers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: EnterpriseTier[] }>("/enterprise-tiers");
      setTiers(res.data.data);
    } catch {
      toast.error("Failed to load enterprise tiers");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadTiers(); }, [loadTiers]);

  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
              <Layers size={24} className="text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Enterprise Tiers</h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Configure business size tiers for vendor classification
              </p>
            </div>
          </div>
          <button
            onClick={() => { setEditingTier(null); setShowModal(true); }}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-800 transition-all"
          >
            <Plus size={16} /> Create Tier
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
          </div>
        ) : tiers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50">
              <Layers size={28} className="text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">No tiers configured</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Create enterprise tiers to classify vendors by business size
            </p>
            <button
              onClick={() => { setEditingTier(null); setShowModal(true); }}
              className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 transition-all"
            >
              <Plus size={16} /> Create Tier
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tiers.map((tier) => {
              const colorClass = TIER_COLORS[tier.size] ?? TIER_COLORS.MICRO;
              const isExpanded = expandedTier === tier.id;
              return (
                <div
                  key={tier.id}
                  className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-all hover:shadow-md ${
                    isExpanded ? "md:col-span-2 lg:col-span-3" : ""
                  }`}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{tier.name}</h3>
                        <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}>
                          {tier.size}
                        </span>
                      </div>
                      <button
                        onClick={() => { setEditingTier(tier); setShowModal(true); }}
                        className="rounded-lg border border-gray-300 dark:border-gray-600 p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>

                    <div className={`mt-4 grid gap-3 ${isExpanded ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
                        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          <IndianRupee size={11} /> Revenue
                        </p>
                        <p className="mt-0.5 text-xs font-bold text-gray-900 dark:text-gray-100">
                          {formatCurrency(tier.minAnnualRevenue)} — {formatCurrency(tier.maxAnnualRevenue)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
                        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          <Percent size={11} /> Commission
                        </p>
                        <p className="mt-0.5 text-xs font-bold text-gray-900 dark:text-gray-100">
                          {tier.defaultCommissionRate !== null ? `${tier.defaultCommissionRate}%` : "Standard"}
                        </p>
                      </div>
                      {isExpanded && (
                        <>
                          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
                            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                              <BookOpen size={11} /> Max Khata
                            </p>
                            <p className="mt-0.5 text-xs font-bold text-gray-900 dark:text-gray-100">
                              {tier.maxKhataLimit !== null ? formatCurrency(tier.maxKhataLimit) : "Custom"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
                            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                              <TrendingUp size={11} /> Vendors
                            </p>
                            <p className="mt-0.5 text-xs font-bold text-gray-900 dark:text-gray-100">
                              {tier._count?.vendors ?? 0}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {tier.description && (
                      <p className={`mt-3 text-xs text-gray-600 dark:text-gray-300 ${isExpanded ? "" : "line-clamp-2"}`}>
                        {tier.description}
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between">
                      <button
                        onClick={() => setExpandedTier(isExpanded ? null : tier.id)}
                        className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300"
                      >
                        {isExpanded ? "Show less" : "Show more"}
                      </button>
                      {tier._count?.vendors !== undefined && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                          <CheckCircle2 size={10} />
                          {tier._count.vendors} vendor{tier._count.vendors !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <TierFormModal
          tier={editingTier}
          onClose={() => { setShowModal(false); setEditingTier(null); }}
          onSuccess={loadTiers}
        />
      )}
    </RoleGuard>
  );
}
