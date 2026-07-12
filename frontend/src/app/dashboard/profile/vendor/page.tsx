"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  Store,
  FileText,
  IdCard,
  BadgeCheck,
  Clock,
  XCircle,
  ShieldCheck,
  Percent,
  Award,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

// ─── KYC status config ────────────────────────────────────────────────────────

const KYC_STYLES: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  APPROVED: { bg: "bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300", icon: BadgeCheck },
  PENDING: { bg: "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", icon: Clock },
  REJECTED: { bg: "bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30", text: "text-red-800", icon: XCircle },
  NOT_SUBMITTED: { bg: "bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50", text: "text-gray-600 dark:text-gray-300 dark:text-gray-300", icon: Clock },
};

function KycBadge({ status }: { status?: string | null }) {
  const config = KYC_STYLES[status ?? "NOT_SUBMITTED"] ?? KYC_STYLES.NOT_SUBMITTED;
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        config.bg,
        config.text,
      )}
    >
      <Icon size={12} />
      {status ?? "Not Submitted"}
    </span>
  );
}

// ─── Tier badge ───────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier?: string | null }) {
  if (!tier) return <span className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">—</span>;

  const colors: Record<string, string> = {
    MICRO: "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-700 dark:text-gray-200 dark:text-gray-200",
    SMALL: "bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    MEDIUM: "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    LARGE: "bg-purple-50 dark:bg-purple-900/30 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
    ENTERPRISE: "bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        colors[tier] ?? "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-600 dark:text-gray-300 dark:text-gray-300",
      )}
    >
      <Award size={12} />
      {tier}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorProfilePage() {
  const { user, updateVendorProfile } = useAuthStore();
  const vp = user?.vendorProfile;

  const [isSaving, setIsSaving] = useState(false);
  const [businessName, setBusinessName] = useState(vp?.businessName ?? "");
  const [gstNumber, setGstNumber] = useState(vp?.gstNumber ?? "");
  const [panNumber, setPanNumber] = useState(vp?.panNumber ?? "");

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!businessName.trim()) {
      toast.error("Business name is required");
      return;
    }

    // Basic GST validation (15 chars: 2 digits + 5 letters + 4 digits + letter + Z + alphanumeric)
    const gst = gstNumber.trim().toUpperCase();
    if (gst && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z\d[A-Z\d]$/.test(gst)) {
      toast.error("Enter a valid GST number (e.g., 27AABCS1234A1ZC)");
      return;
    }

    // Basic PAN validation (10 chars: 5 letters + 4 digits + 1 letter)
    const pan = panNumber.trim().toUpperCase();
    if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) {
      toast.error("Enter a valid PAN (e.g., ABCDE1234F)");
      return;
    }

    setIsSaving(true);
    try {
      await updateVendorProfile({
        businessName: businessName.trim(),
        gstNumber: gst || undefined,
        panNumber: pan || undefined,
      });
      toast.success("Vendor profile updated successfully");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message ?? "Failed to update vendor profile",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/profile"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-colors hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-200"
        >
          <ArrowLeft size={14} />
          Back to Profile
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Vendor Profile</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300 dark:text-gray-300">
          Manage your business information and tax details
        </p>
      </div>

      <div className="space-y-6">
        {/* ── Business Overview Card ── */}
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30">
          <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-6 py-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800/20">
                <Store size={32} className="text-white" />
              </div>
              <div className="text-white">
                <h2 className="text-xl font-bold">
                  {vp?.businessName ?? "Business Name"}
                </h2>
                <p className="mt-0.5 text-sm text-blue-100">
                  {user?.fullName}
                </p>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700 dark:divide-gray-700">
            <div className="p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Commission
              </p>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {vp?.commissionRate ?? 0}%
              </p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                KYC Status
              </p>
              <div className="mt-1 flex justify-center">
                <KycBadge status={vp?.kycStatus} />
              </div>
            </div>
            <div className="p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Enterprise Tier
              </p>
              <div className="mt-1 flex justify-center">
                <TierBadge tier={vp?.tier} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Business Details Form ── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30">
              <Store size={20} className="text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                Business Details
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Your registered business information
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Business Name */}
            <div>
              <label
                htmlFor="businessName"
                className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200"
              >
                Business Name <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                id="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-blue-500 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500/20"
                placeholder="Your business name"
              />
            </div>

            {/* GST Number */}
            <div>
              <label
                htmlFor="gstNumber"
                className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200"
              >
                GST Number
              </label>
              <div className="relative">
                <input
                  id="gstNumber"
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 pl-10 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-blue-500 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500/20"
                  placeholder="27AABCS1234A1ZC"
                  maxLength={15}
                />
                <FileText
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                15-character GSTIN (e.g., 27AABCS1234A1ZC)
              </p>
            </div>

            {/* PAN Number */}
            <div>
              <label
                htmlFor="panNumber"
                className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200"
              >
                PAN Number
              </label>
              <div className="relative">
                <input
                  id="panNumber"
                  type="text"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 pl-10 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-blue-500 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500/20"
                  placeholder="ABCDE1234F"
                  maxLength={10}
                />
                <IdCard
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                10-character PAN (e.g., ABCDE1234F)
              </p>
            </div>
          </div>
        </div>

        {/* ── KYC & Compliance Info ── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/30 dark:bg-purple-900/30">
              <ShieldCheck size={20} className="text-purple-700 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                KYC &amp; Compliance
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Verification status and enterprise classification
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-100 dark:border-gray-700 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                KYC Status
              </p>
              <div className="mt-2">
                <KycBadge status={vp?.kycStatus} />
              </div>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                {vp?.kycStatus === "APPROVED"
                  ? "Your KYC documents have been verified"
                  : vp?.kycStatus === "PENDING"
                    ? "Your KYC documents are under review"
                    : vp?.kycStatus === "REJECTED"
                      ? "Your KYC documents were rejected. Please resubmit."
                      : "KYC not yet submitted"}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 dark:border-gray-700 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Commission Rate
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Percent size={16} className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                  {vp?.commissionRate ?? 0}%
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Applied per-sale commission
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 dark:border-gray-700 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Enterprise Tier
              </p>
              <div className="mt-2">
                <TierBadge tier={vp?.tier} />
              </div>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Based on revenue and business volume
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 dark:border-gray-700 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Phone (Business)
              </p>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {user?.phoneNumber ?? "—"}
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Registered contact number
              </p>
            </div>
          </div>
        </div>

        {/* ── Save ── */}
        <div className="flex items-center justify-end gap-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-950/30">
          <Link
            href="/dashboard/profile"
            className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save Vendor Profile
          </button>
        </div>
      </div>
    </div>
  );
}
