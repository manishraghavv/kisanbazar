"use client";

import { useEffect, useState, useCallback } from "react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import {
  Building2,
  Loader2,
  Factory,
  Layers,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  BookOpen,
  Save,
  RefreshCw,
  IndianRupee,
  Percent,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Industry {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  _count?: { vendors: number };
}

interface EnterpriseTier {
  id: string;
  name: string;
  size: "MICRO" | "SMALL" | "MEDIUM" | "LARGE" | "ENTERPRISE";
  minAnnualRevenue: number | null;
  maxAnnualRevenue: number | null;
  defaultCommissionRate: number | null;
  maxKhataLimit: number | null;
  description: string | null;
  _count?: { vendors: number };
}

interface VendorEnterprise {
  id: string;
  businessName: string;
  industryId: string | null;
  enterpriseTierId: string | null;
  industry: Industry | null;
  enterpriseTier: EnterpriseTier | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number | null) {
  if (amount === null) return "—";
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const TIER_COLORS: Record<string, string> = {
  MICRO:      "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600",
  SMALL:      "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  MEDIUM:     "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  LARGE:      "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  ENTERPRISE: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
};

const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorEnterprisePage() {
  const [vendorData, setVendorData] = useState<VendorEnterprise | null>(null);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [tiers, setTiers] = useState<EnterpriseTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedIndustryId, setSelectedIndustryId] = useState<string | null>(null);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [enterpriseRes, industriesRes, tiersRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: VendorEnterprise }>("/vendors/me/enterprise"),
        apiClient.get<{ success: boolean; data: Industry[] }>("/industries", { params: { isActive: true, limit: 50 } }),
        apiClient.get<{ success: boolean; data: EnterpriseTier[] }>("/enterprise-tiers"),
      ]);
      const vendor = enterpriseRes.data.data;
      setVendorData(vendor);
      setSelectedIndustryId(vendor.industryId);
      setSelectedTierId(vendor.enterpriseTierId);
      setIndustries(industriesRes.data.data);
      setTiers(tiersRes.data.data);
    } catch {
      toast.error("Failed to load enterprise data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiClient.put("/vendors/me/enterprise", {
        industryId: selectedIndustryId || null,
        enterpriseTierId: selectedTierId || null,
      });
      toast.success("Enterprise classification updated");
      await loadData();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? "Failed to update enterprise classification");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    selectedIndustryId !== vendorData?.industryId ||
    selectedTierId !== vendorData?.enterpriseTierId;

  const selectedTier = tiers.find((t) => t.id === selectedTierId);

  return (
    <RoleGuard allowedRoles={["VENDOR"]}>
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
              <Building2 size={24} className="text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Enterprise</h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Manage your business classification, industry, and enterprise tier
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">

            {/* ── Left Column: Classification Form ── */}
            <div className="space-y-6 lg:col-span-2">

              {/* Classification Card */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
                <h2 className="mb-5 text-base font-bold text-gray-900 dark:text-gray-100">
                  Business Classification
                </h2>

                <div className="space-y-5">

                  {/* Industry */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <Factory size={13} /> Industry
                    </label>
                    <select
                      value={selectedIndustryId ?? ""}
                      onChange={(e) => setSelectedIndustryId(e.target.value || null)}
                      className={inputCls}
                    >
                      <option value="">Select industry...</option>
                      {industries.map((ind) => (
                        <option key={ind.id} value={ind.id}>{ind.name}</option>
                      ))}
                    </select>
                    {industries.length === 0 && (
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        No industries available yet
                      </p>
                    )}
                  </div>

                  {/* Enterprise Tier */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <Layers size={13} /> Enterprise Tier
                    </label>
                    <select
                      value={selectedTierId ?? ""}
                      onChange={(e) => setSelectedTierId(e.target.value || null)}
                      className={inputCls}
                    >
                      <option value="">Select tier...</option>
                      {tiers.map((tier) => (
                        <option key={tier.id} value={tier.id}>
                          {tier.name} ({tier.size})
                        </option>
                      ))}
                    </select>
                    {tiers.length === 0 && (
                      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        No enterprise tiers configured yet
                      </p>
                    )}
                  </div>

                  {/* Save / Reset */}
                  {hasChanges && (
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        onClick={() => {
                          setSelectedIndustryId(vendorData?.industryId ?? null);
                          setSelectedTierId(vendorData?.enterpriseTierId ?? null);
                        }}
                        className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <RefreshCw size={14} className="inline mr-1.5" />
                        Reset
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50 transition-all"
                      >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {isSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Tier Benefits */}
              {selectedTier && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
                  <h2 className="mb-4 text-base font-bold text-gray-900 dark:text-gray-100">
                    {selectedTier.name} Benefits
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      {
                        icon: <IndianRupee size={14} className="text-gray-400 dark:text-gray-500" />,
                        label: "Revenue Range",
                        value: `${formatCurrency(selectedTier.minAnnualRevenue)} — ${formatCurrency(selectedTier.maxAnnualRevenue)}`,
                      },
                      {
                        icon: <Percent size={14} className="text-gray-400 dark:text-gray-500" />,
                        label: "Commission Rate",
                        value: selectedTier.defaultCommissionRate !== null
                          ? `${selectedTier.defaultCommissionRate}%`
                          : "Standard",
                      },
                      {
                        icon: <BookOpen size={14} className="text-gray-400 dark:text-gray-500" />,
                        label: "Max Khata Limit",
                        value: selectedTier.maxKhataLimit !== null
                          ? formatCurrency(selectedTier.maxKhataLimit)
                          : "Custom",
                      },
                      {
                        icon: <ShieldCheck size={14} className="text-gray-400 dark:text-gray-500" />,
                        label: "Tier Size",
                        value: null,
                        badge: selectedTier.size,
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 p-4"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {card.icon}
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            {card.label}
                          </p>
                        </div>
                        {card.badge ? (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TIER_COLORS[card.badge] ?? TIER_COLORS.MICRO}`}>
                            {card.badge}
                          </span>
                        ) : (
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{card.value}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {selectedTier.description && (
                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">{selectedTier.description}</p>
                  )}
                </div>
              )}
            </div>

            {/* ── Right Column: Current Status ── */}
            <div className="space-y-4">

              {/* Current Classification */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">
                  Current Classification
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Business</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{vendorData?.businessName ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Industry</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {vendorData?.industry?.name ?? (
                        <span className="italic text-gray-400 dark:text-gray-500">Not set</span>
                      )}
                    </p>
                    {vendorData?.industry?.description && (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {vendorData.industry.description}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Enterprise Tier</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {vendorData?.enterpriseTier?.name ?? (
                        <span className="italic text-gray-400 dark:text-gray-500">Not classified</span>
                      )}
                    </p>
                    {vendorData?.enterpriseTier && (
                      <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${TIER_COLORS[vendorData.enterpriseTier.size] ?? TIER_COLORS.MICRO}`}>
                        {vendorData.enterpriseTier.size}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Available Tiers */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">Available Tiers</h3>
                <div className="space-y-2">
                  {tiers.length === 0 ? (
                    <p className="text-xs italic text-gray-400 dark:text-gray-500">No tiers configured</p>
                  ) : (
                    tiers.map((tier) => (
                      <div
                        key={tier.id}
                        className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                          tier.id === selectedTierId
                            ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30"
                            : "border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TIER_COLORS[tier.size] ?? TIER_COLORS.MICRO}`}>
                            {tier.size}
                          </span>
                          <div>
                            <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{tier.name}</p>
                            {tier.defaultCommissionRate !== null && (
                              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                {tier.defaultCommissionRate}% commission
                              </p>
                            )}
                          </div>
                        </div>
                        {tier.id === selectedTierId && (
                          <CheckCircle2 size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Info Card */}
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 p-4">
                <div className="flex items-start gap-2">
                  <TrendingUp size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Why classify?</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-400">
                      Enterprise classification helps us tailor commission rates, credit limits, and platform
                      benefits to your business size and industry.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
