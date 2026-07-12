"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  Wheat,
  MapPin,
  LandPlot,
  Hash,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

// ─── Indian states ────────────────────────────────────────────────────────────

const STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

// ─── Common Indian crops ──────────────────────────────────────────────────────

const CROPS = [
  "Wheat",
  "Rice",
  "Cotton",
  "Sugarcane",
  "Maize",
  "Paddy",
  "Mustard",
  "Groundnut",
  "Soybean",
  "Pulses",
  "Tea",
  "Coffee",
  "Potato",
  "Onion",
  "Tomato",
  "Chilli",
  "Turmeric",
  "Ginger",
  "Coconut",
  "Banana",
  "Mango",
  "Grapes",
  "Orange",
  "Apple",
  "Sesame",
  "Jowar",
  "Bajra",
  "Sunflower",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FarmerProfilePage() {
  const { user, updateFarmerProfile } = useAuthStore();
  const fp = user?.farmerProfile;

  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [village, setVillage] = useState(fp?.village ?? "");
  const [district, setDistrict] = useState(fp?.district ?? "");
  const [state, setState] = useState(fp?.state ?? "");
  const [pincode, setPincode] = useState(fp?.pincode ?? "");
  const [landAreaAcres, setLandAreaAcres] = useState(
    fp?.landAreaAcres != null ? String(fp.landAreaAcres) : "",
  );
  const [selectedCrops, setSelectedCrops] = useState<string[]>(
    fp?.primaryCrops ?? [],
  );

  const toggleCrop = (crop: string) => {
    setSelectedCrops((prev) =>
      prev.includes(crop)
        ? prev.filter((c) => c !== crop)
        : [...prev, crop],
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateFarmerProfile({
        village: village.trim() || undefined,
        district: district.trim() || undefined,
        state: state || undefined,
        pincode: pincode.trim() || undefined,
        landAreaAcres: landAreaAcres ? Number(landAreaAcres) : undefined,
        primaryCrops: selectedCrops.length > 0 ? selectedCrops : undefined,
      });
      toast.success("Farmer profile updated successfully");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message ?? "Failed to update farmer profile",
      );
    } finally {
      setIsSaving(false);
    }
  };

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Farmer Profile</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300 dark:text-gray-300">
          Manage your farm and location details
        </p>
      </div>

      <div className="space-y-6">
        {/* ── Location Details ── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30">
              <MapPin size={20} className="text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                Location Details
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Village, district, state, and pincode
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Village */}
            <div>
              <label
                htmlFor="village"
                className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200"
              >
                Village / Town
              </label>
              <input
                id="village"
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
                placeholder="e.g., Rampur"
              />
            </div>

            {/* District */}
            <div>
              <label
                htmlFor="district"
                className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200"
              >
                District
              </label>
              <input
                id="district"
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
                placeholder="e.g., Jaipur"
              />
            </div>

            {/* State */}
            <div>
              <label
                htmlFor="state"
                className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200"
              >
                State
              </label>
              <select
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
              >
                <option value="">Select state</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Pincode */}
            <div>
              <label
                htmlFor="pincode"
                className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200"
              >
                Pincode
              </label>
              <input
                id="pincode"
                type="text"
                inputMode="numeric"
                value={pincode}
                onChange={(e) =>
                  setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
                placeholder="6-digit pincode"
                maxLength={6}
              />
            </div>
          </div>
        </div>

        {/* ── Land Details ── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30">
              <LandPlot size={20} className="text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                Land Details
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Your farmland area in acres
              </p>
            </div>
          </div>

          <div className="max-w-xs">
            <label
              htmlFor="landArea"
              className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200"
            >
              Land Area (Acres)
            </label>
            <div className="relative">
              <input
                id="landArea"
                type="text"
                inputMode="decimal"
                value={landAreaAcres}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, "");
                  // Prevent multiple decimal points
                  if ((val.match(/\./g) || []).length > 1) return;
                  setLandAreaAcres(val);
                }}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 pr-12 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
                placeholder="e.g., 5.5"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                acres
              </span>
            </div>
          </div>
        </div>

        {/* ── Crops ── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30">
              <Wheat size={20} className="text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                Primary Crops
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Select the crops you grow (tap to toggle)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {CROPS.map((crop) => {
              const selected = selectedCrops.includes(crop);
              return (
                <button
                  key={crop}
                  type="button"
                  onClick={() => toggleCrop(crop)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                    selected
                      ? "bg-emerald-700 text-white shadow-sm dark:shadow-gray-950/30"
                      : "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-200 dark:bg-gray-600",
                  )}
                >
                  {crop}
                </button>
              );
            })}
          </div>

          {selectedCrops.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              <Hash size={12} />
              <span>
                {selectedCrops.length} crop{selectedCrops.length > 1 ? "s" : ""}{" "}
                selected
              </span>
            </div>
          )}
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
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save Farmer Profile
          </button>
        </div>
      </div>
    </div>
  );
}
