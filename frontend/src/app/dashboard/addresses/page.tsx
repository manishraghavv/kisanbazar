"use client";

import { useEffect, useState } from "react";
import { useAddressStore } from "@/stores/addressStore";
import { toast } from "sonner";
import {
  Plus,
  MapPin,
  Star,
  Pencil,
  Trash2,
  Loader2,
  Check,
  ArrowLeft,
  X,
  Home,
  Briefcase,
  Building2,
} from "lucide-react";
import Link from "next/link";
import type { CreateAddressPayload, UpdateAddressPayload } from "@/types/auth";

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

// ─── Label options ────────────────────────────────────────────────────────────

const LABEL_OPTIONS = [
  { value: "Home", icon: Home, color: "text-emerald-600 dark:text-emerald-400" },
  { value: "Farm", icon: MapPin, color: "text-amber-600 dark:text-amber-400" },
  { value: "Office", icon: Briefcase, color: "text-blue-600" },
  { value: "Warehouse", icon: Building2, color: "text-purple-600" },
  { value: "Other", icon: MapPin, color: "text-gray-600 dark:text-gray-300 dark:text-gray-300" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLabelIcon(label: string | null | undefined) {
  if (!label) return MapPin;
  const found = LABEL_OPTIONS.find((l) => l.value === label);
  return found?.icon ?? MapPin;
}

function getLabelColor(label: string | null | undefined) {
  if (!label) return "text-gray-600 dark:text-gray-300 dark:text-gray-300";
  const found = LABEL_OPTIONS.find((l) => l.value === label);
  return found?.color ?? "text-gray-600 dark:text-gray-300 dark:text-gray-300";
}

// ─── Address Form Component (shared between add & edit) ───────────────────────

function AddressForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial?: {
    id?: string;
    label: string;
    addressLine1: string;
    addressLine2: string;
    village: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
    isDefault: boolean;
  };
  onSave: (data: CreateAddressPayload | UpdateAddressPayload) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [addressLine1, setAddressLine1] = useState(initial?.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(initial?.addressLine2 ?? "");
  const [village, setVillage] = useState(initial?.village ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [district, setDistrict] = useState(initial?.district ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [pincode, setPincode] = useState(initial?.pincode ?? "");
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!addressLine1.trim()) {
      newErrors.addressLine1 = "Address line 1 is required";
    }
    if (!city.trim()) {
      newErrors.city = "City is required";
    }
    if (!state) {
      newErrors.state = "Please select a state";
    }
    if (!pincode.trim() || !/^\d{6}$/.test(pincode)) {
      newErrors.pincode = "Enter a valid 6-digit pincode";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const data = {
      label: label || undefined,
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim() || undefined,
      village: village.trim() || undefined,
      city: city.trim(),
      district: district.trim() || undefined,
      state,
      pincode: pincode.trim(),
    } satisfies Partial<CreateAddressPayload>;

    if (initial?.id) {
      // Only send changed fields for update
      const payload: UpdateAddressPayload = {};
      for (const [key, value] of Object.entries(data)) {
        const initVal = (initial as Record<string, unknown>)[key];
        if (value !== initVal && value !== undefined) {
          (payload as Record<string, unknown>)[key] = value;
        }
      }
      if (isDefault !== initial.isDefault) {
        payload.isDefault = isDefault;
      }
      onSave(payload);
    } else {
      onSave({
        ...data,
        isDefault,
      } as CreateAddressPayload);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Label */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200">
          Label <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {LABEL_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = label === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLabel(selected ? "" : opt.value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                  selected
                    ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"
                    : "border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50"
                }`}
              >
                <Icon size={13} className={selected ? "text-emerald-600 dark:text-emerald-400" : opt.color} />
                {opt.value}
              </button>
            );
          })}
        </div>
      </div>

      {/* Address Line 1 */}
      <div>
        <label htmlFor="addressLine1" className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200">
          Address Line 1 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          id="addressLine1"
          type="text"
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20 ${
            errors.addressLine1 ? "border-red-400" : "border-gray-300 dark:border-gray-600 dark:border-gray-600"
          }`}
          placeholder="House / Shop / Farm number, street"
        />
        {errors.addressLine1 && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.addressLine1}</p>}
      </div>

      {/* Address Line 2 */}
      <div>
        <label htmlFor="addressLine2" className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200">
          Address Line 2 <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">(optional)</span>
        </label>
        <input
          id="addressLine2"
          type="text"
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
          placeholder="Area, landmark, colony"
        />
      </div>

      {/* Village + City row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="village" className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200">
            Village / Town <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">(optional)</span>
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
        <div>
          <label htmlFor="city" className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200">
            City / Town <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <input
            id="city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20 ${
              errors.city ? "border-red-400" : "border-gray-300 dark:border-gray-600 dark:border-gray-600"
            }`}
            placeholder="e.g., Jaipur"
          />
          {errors.city && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.city}</p>}
        </div>
      </div>

      {/* District + State row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="district" className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200">
            District <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">(optional)</span>
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
        <div>
          <label htmlFor="state" className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200">
            State <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <select
            id="state"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20 ${
              errors.state ? "border-red-400" : "border-gray-300 dark:border-gray-600 dark:border-gray-600"
            }`}
          >
            <option value="">Select state</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.state && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.state}</p>}
        </div>
      </div>

      {/* Pincode */}
      <div className="max-w-xs">
        <label htmlFor="pincode" className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200">
          Pincode <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          id="pincode"
          type="text"
          inputMode="numeric"
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className={`w-full rounded-lg border px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20 ${
            errors.pincode ? "border-red-400" : "border-gray-300 dark:border-gray-600 dark:border-gray-600"
          }`}
          placeholder="6-digit pincode"
          maxLength={6}
        />
        {errors.pincode && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.pincode}</p>}
      </div>

      {/* Default toggle */}
      <label className="flex items-center gap-2.5 cursor-pointer">
        <div
          onClick={() => setIsDefault(!isDefault)}
          className={`flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            isDefault ? "bg-emerald-600" : "bg-gray-300"
          }`}
        >
          <div
            className={`h-4 w-4 rounded-full bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30 transition-transform ${
              isDefault ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-200">Set as default address</span>
      </label>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-700 dark:border-gray-700">
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {initial?.id ? "Save Changes" : "Add Address"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteModal({
  address,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  address: { label?: string | null; addressLine1: string; city: string };
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30">
          <Trash2 size={24} className="text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-center text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Delete Address?</h3>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">
          Are you sure you want to delete this address?
        </p>
        <div className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{address.label || "Address"}</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{address.addressLine1}, {address.city}</p>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Address Card ─────────────────────────────────────────────────────────────

/* eslint-disable react-hooks/static-components */
function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  address: import("@/types/auth").Address;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}) {
  const Icon = getLabelIcon(address.label);

  return (
    <div
      className={`group relative rounded-xl border bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30 ${
        address.isDefault ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/30" : "border-gray-200 dark:border-gray-700 dark:border-gray-700"
      }`}
    >
      {/* Default badge */}
      {address.isDefault && (
        <div className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-0.5 text-[11px] font-semibold text-white shadow-sm dark:shadow-gray-950/30">
          <Star size={11} />
          Default
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              address.isDefault
                ? "bg-emerald-100 dark:bg-emerald-900/50"
                : "bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 group-hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"
            } transition-colors`}
          >
            <Icon size={18} className={address.isDefault ? "text-emerald-700 dark:text-emerald-400" : getLabelColor(address.label)} />
          </div>
          <div className="min-w-0 flex-1">
            {address.label && (
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{address.label}</p>
            )}
            <p className={`text-sm ${address.isDefault ? "text-emerald-800 dark:text-emerald-300" : "text-gray-600 dark:text-gray-300 dark:text-gray-300"}`}>
              {address.addressLine1}
              {address.addressLine2 && <>, {address.addressLine2}</>}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              {[address.village, address.city, address.district, address.state]
                .filter(Boolean)
                .join(", ")}
            </p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 dark:text-gray-200">— {address.pincode}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {!address.isDefault && (
            <button
              onClick={onSetDefault}
              title="Set as default"
              className="rounded-lg p-2 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 opacity-0 transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400 group-hover:opacity-100"
            >
              <Star size={15} />
            </button>
          )}
          <button
            onClick={onEdit}
            className="rounded-lg p-2 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 opacity-0 transition-all hover:bg-blue-50 dark:bg-blue-900/30 hover:text-blue-700 group-hover:opacity-100"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-2 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 opacity-0 transition-all hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 hover:text-red-600 group-hover:opacity-100"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* eslint-enable react-hooks/static-components */

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30">
        <MapPin size={36} className="text-emerald-300" />
      </div>
      <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">No addresses yet</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
        Add a shipping address for your orders
      </p>
      <button
        onClick={onAdd}
        className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-800"
      >
        <Plus size={16} />
        Add Address
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AddressesPage() {
  const {
    addresses,
    total,
    isLoading,
    fetchAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  } = useAddressStore();

  // Load addresses on mount
  useEffect(() => {
    fetchAddresses().catch(() => {
      toast.error("Failed to load addresses");
    });
     
  }, [fetchAddresses]);

  // UI state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const editingAddress = editingId ? addresses.find((a) => a.id === editingId) : null;
  const deletingAddress = deletingId ? addresses.find((a) => a.id === deletingId) : null;

  // ── Handlers ──

  const handleCreate = async (data: CreateAddressPayload | UpdateAddressPayload) => {
    setIsSaving(true);
    try {
      await createAddress(data as CreateAddressPayload);
      toast.success("Address added successfully");
      setShowAddForm(false);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to add address");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (data: CreateAddressPayload | UpdateAddressPayload) => {
    if (!editingId) return;
    setIsSaving(true);
    try {
      await updateAddress(editingId, data as UpdateAddressPayload);
      toast.success("Address updated successfully");
      setEditingId(null);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to update address");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await deleteAddress(deletingId);
      toast.success("Address deleted");
      setDeletingId(null);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to delete address");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultAddress(id);
      toast.success("Default address updated");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to set default address");
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/profile"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-colors hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-200"
          >
            <ArrowLeft size={14} />
            Back to Profile
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">My Addresses</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-300 dark:text-gray-300">
            Manage your shipping and delivery addresses
          </p>
        </div>
        {!showAddForm && !editingId && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-800"
          >
            <Plus size={16} />
            Add New
          </button>
        )}
      </div>

      <div className="space-y-5">
        {/* ── Loading ── */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
          </div>
        )}

        {/* ── Add Form ── */}
        {showAddForm && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">New Address</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300"
              >
                <X size={18} />
              </button>
            </div>
            <AddressForm
              onSave={handleCreate}
              onCancel={() => setShowAddForm(false)}
              isSaving={isSaving}
            />
          </div>
        )}

        {/* ── Edit Form (inline) ── */}
        {editingAddress && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30 ring-2 ring-emerald-100">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                Edit Address
                {editingAddress.label && (
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    — {editingAddress.label}
                  </span>
                )}
              </h3>
              <button
                onClick={() => setEditingId(null)}
                className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300"
              >
                <X size={18} />
              </button>
            </div>
            <AddressForm
              initial={{
                id: editingAddress.id,
                label: editingAddress.label ?? "",
                addressLine1: editingAddress.addressLine1,
                addressLine2: editingAddress.addressLine2 ?? "",
                village: editingAddress.village ?? "",
                city: editingAddress.city,
                district: editingAddress.district ?? "",
                state: editingAddress.state,
                pincode: editingAddress.pincode,
                isDefault: editingAddress.isDefault,
              }}
              onSave={handleUpdate}
              onCancel={() => setEditingId(null)}
              isSaving={isSaving}
            />
          </div>
        )}

        {/* ── Address List ── */}
        {!isLoading && addresses.length === 0 && !showAddForm && (
          <EmptyState onAdd={() => setShowAddForm(true)} />
        )}

        {addresses.map((address) => (
          <AddressCard
            key={address.id}
            address={address}
            onEdit={() => setEditingId(address.id)}
            onDelete={() => setDeletingId(address.id)}
            onSetDefault={() => handleSetDefault(address.id)}
          />
        ))}

        {/* ── Footer count ── */}
        {addresses.length > 0 && !showAddForm && !editingId && (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {total} address{total !== 1 ? "es" : ""} saved
          </p>
        )}
      </div>

      {/* ── Delete Modal ── */}
      {deletingAddress && (
        <DeleteModal
          address={deletingAddress}
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
