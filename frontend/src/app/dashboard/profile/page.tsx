"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import {
  User,
  Phone,
  BadgeCheck,
  ShieldCheck,
  MapPin,
  Calendar,
  Save,
  Loader2,
  Sprout,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { UserRole } from "@/types/auth";

// ─── Language options ─────────────────────────────────────────────────────────

const LANGUAGES = [
  { value: "hi", label: "हिन्दी (Hindi)" },
  { value: "en", label: "English" },
  { value: "mr", label: "मराठी (Marathi)" },
  { value: "pa", label: "ਪੰਜਾਬੀ (Punjabi)" },
  { value: "ta", label: "தமிழ் (Tamil)" },
] as const;

// ─── Role badges ──────────────────────────────────────────────────────────────

const ROLE_STYLES: Record<UserRole, { bg: string; text: string; label: string }> = {
  FARMER: { bg: "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", label: "Farmer" },
  VENDOR: { bg: "bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", label: "Vendor" },
  ADMIN: { bg: "bg-purple-50 dark:bg-purple-900/30 dark:bg-purple-900/30", text: "text-purple-800", label: "Admin" },
  DELIVERY: { bg: "bg-cyan-50 dark:bg-cyan-900/30 dark:bg-cyan-900/30", text: "text-cyan-800", label: "Delivery" },
};

// ─── Profile field component ──────────────────────────────────────────────────

function ProfileField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 dark:border-gray-700 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30">
        <Icon size={18} className="text-emerald-700 dark:text-emerald-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
          {value ?? "—"}
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, updateProfile } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [languagePref, setLanguagePref] = useState(user?.languagePref ?? "hi");

  const roleStyle = user?.role ? ROLE_STYLES[user.role] : null;

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        languagePref,
      });
      toast.success("Profile updated successfully");
      setIsEditing(false);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(user?.fullName ?? "");
    setEmail(user?.email ?? "");
    setLanguagePref(user?.languagePref ?? "hi");
    setIsEditing(false);
  };

  // Role profile links
  const roleProfileLinks: Partial<Record<UserRole, { href: string; label: string }>> = {
    FARMER: { href: "/dashboard/profile/farmer", label: "Farmer Profile" },
    VENDOR: { href: "/dashboard/profile/vendor", label: "Vendor Profile" },
  };

  const roleLink = user?.role ? roleProfileLinks[user.role] : null;

  // Initials avatar
  const initials = (user?.fullName ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">My Profile</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300 dark:text-gray-300">
          Manage your personal information and preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* ── Avatar & Identity Card ── */}
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30">
          <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-6 py-8 sm:px-8">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              {/* Avatar */}
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white dark:bg-gray-800 dark:bg-gray-800/20 text-3xl font-bold tracking-wide text-white shadow-inner ring-4 ring-white/30">
                {initials}
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-xl font-bold text-white">
                  {user?.fullName ?? "User"}
                </h2>
                <p className="mt-0.5 text-sm text-emerald-100">
                  {user?.email ?? "No email set"}
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                  {roleStyle && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold",
                        roleStyle.bg,
                        roleStyle.text,
                      )}
                    >
                      <ShieldCheck size={12} />
                      {roleStyle.label}
                    </span>
                  )}
                  {user?.isPhoneVerified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 px-3 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      <BadgeCheck size={12} />
                      Verified
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick info */}
          <div className="grid gap-px bg-gray-200 dark:bg-gray-600 dark:bg-gray-600 sm:grid-cols-2">
            <ProfileField label="Phone" value={user?.phoneNumber} icon={Phone} />
            <ProfileField
              label="Member Since"
              value={
                user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("en-IN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : null
              }
              icon={Calendar}
            />
            <ProfileField label="Referral Code" value={user?.referralCode} icon={User} />
            <ProfileField
              label="Device"
              value={user?.deviceType ?? "Web"}
              icon={MapPin}
            />
          </div>
        </div>

        {/* ── Edit Form ── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
              Personal Information
            </h3>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 px-4 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-300 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
              >
                Edit
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-5">
              {/* Full Name */}
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200"
                >
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
                  placeholder="Your full name"
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
                  placeholder="your@email.com"
                />
              </div>

              {/* Language Preference */}
              <div>
                <label
                  htmlFor="language"
                  className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200"
                >
                  Language Preference
                </label>
                <select
                  id="language"
                  value={languagePref}
                  onChange={(e) => setLanguagePref(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Save Changes
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Read-only view */
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    Full Name
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                    {user?.fullName ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    Email
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                    {user?.email || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    Language
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                    {LANGUAGES.find((l) => l.value === user?.languagePref)
                      ?.label ?? "English"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    Phone
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                    {user?.phoneNumber ?? "—"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Role-specific profile link ── */}
        {roleLink && (
          <Link
            href={roleLink.href}
            className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30 transition-all hover:border-emerald-200 dark:hover:border-emerald-700 hover:shadow-md dark:shadow-gray-950/30"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30">
                <Sprout size={22} className="text-emerald-700 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                  {roleLink.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Manage your {user?.role?.toLowerCase()}-specific details
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
          </Link>
        )}
      </div>
    </div>
  );
}
