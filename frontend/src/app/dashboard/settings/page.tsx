"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import apiClient from "@/lib/api-client";
import { toast } from "sonner";
import { User, Save, Loader2, Phone, Mail, Globe, Shield, Download, CheckCircle2, Smartphone, ArrowRight, ArrowLeft, Trash2, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [languagePref, setLanguagePref] = useState(user?.languagePref ?? "en");
  const [isSaving, setIsSaving] = useState(false);

  // Change Phone state
  const [showChangePhone, setShowChangePhone] = useState(false);
  const [changePhoneStep, setChangePhoneStep] = useState<"input" | "otp">("input");
  const [newPhone, setNewPhone] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // OTP digits
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const setInputRef = useCallback(
    (index: number) => (el: HTMLInputElement | null) => {
      inputRefs.current[index] = el;
    },
    [],
  );

  // Focus first OTP input when step changes to otp
  useEffect(() => {
    if (changePhoneStep === "otp") {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [changePhoneStep]);

  const handleDigitChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const otp = digits.join("");

  // Send OTP to new phone number
  const handleSendOtp = async () => {
    const cleaned = newPhone.replace(/\D/g, "");
    if (cleaned.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    setIsSendingOtp(true);
    try {
      // Send OTP to new number — the backend endpoint handles this
      // We call PUT /users/me/phone with just the new number to trigger OTP
      await apiClient.put("/users/me/phone", { newPhone: cleaned });
      setChangePhoneStep("otp");
      setDigits(["", "", "", "", "", ""]);
      toast.success("OTP sent to new number");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to send OTP");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Verify OTP and update phone number
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;

    setIsVerifyingOtp(true);
    try {
      const response = await apiClient.put("/users/me/phone", {
        newPhone: newPhone.replace(/\D/g, ""),
        otp,
      });
      // Update local user state with new phone
      setUser({ ...user!, phoneNumber: response.data.data?.phoneNumber ?? newPhone });
      toast.success("Phone number updated successfully");
      resetChangePhone();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "OTP verification failed");
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const resetChangePhone = () => {
    setShowChangePhone(false);
    setChangePhoneStep("input");
    setNewPhone("");
    setDigits(["", "", "", "", "", ""]);
  };

  // Farmer-specific
  const [village, setVillage] = useState(user?.farmerProfile?.village ?? "");
  const [district, setDistrict] = useState(user?.farmerProfile?.district ?? "");
  const [state, setState] = useState(user?.farmerProfile?.state ?? "");
  const [landAreaAcres, setLandAreaAcres] = useState(user?.farmerProfile?.landAreaAcres?.toString() ?? "");

  // Vendor-specific
  const [businessName, setBusinessName] = useState(user?.vendorProfile?.businessName ?? "");
  const [gstNumber, setGstNumber] = useState(user?.vendorProfile?.gstNumber ?? "");
  const [panNumber, setPanNumber] = useState(user?.vendorProfile?.panNumber ?? "");

  // Delete Account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const data: Record<string, string> = { fullName: fullName.trim() };
      if (email.trim()) data.email = email.trim();
      data.languagePref = languagePref;

      await apiClient.put("/users/me", data);
      toast.success("Profile updated");
      const response = await apiClient.get("/users/me");
      setUser(response.data.data);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFarmerProfile = async () => {
    setIsSaving(true);
    try {
      const data: Record<string, string | number> = {};
      if (village.trim()) data.village = village.trim();
      if (district.trim()) data.district = district.trim();
      if (state.trim()) data.state = state.trim();
      if (landAreaAcres) data.landAreaAcres = Number(landAreaAcres);

      await apiClient.put("/users/me/farmer-profile", data);
      toast.success("Farmer profile updated");
    } catch {
      toast.error("Failed to update farmer profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveVendorProfile = async () => {
    setIsSaving(true);
    try {
      const data: Record<string, string> = {};
      if (businessName.trim()) data.businessName = businessName.trim();
      if (gstNumber.trim()) data.gstNumber = gstNumber.trim();
      if (panNumber.trim()) data.panNumber = panNumber.trim();

      await apiClient.put("/users/me/vendor-profile", data);
      toast.success("Vendor profile updated");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to update vendor profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await apiClient.delete("/users/me");
      toast.success("Account deleted successfully");
      await logout();
      router.push("/auth/login");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportData = async () => {
    try {
      const response = await apiClient.post("/users/me/export", {
        types: ["profile", "orders", "khata", "reviews", "wallet"],
      });
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kisaan-bazaar-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully");
    } catch {
      toast.error("Failed to export data");
    }
  };

  const role = user?.role;

  const displayCurrentPhone = user?.phoneNumber
    ? user.phoneNumber.replace(/(\d{5})(\d{5})/, "$1 $2")
    : "Not set";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Manage your account preferences</p>
      </div>

      {/* Profile Section */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30"><User size={18} className="text-emerald-700 dark:text-emerald-400" /></div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Profile</h2>
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Full Name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Not set"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Language</label>
            <select value={languagePref} onChange={e => setLanguagePref(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400">
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="mr">Marathi</option>
              <option value="pa">Punjabi</option>
              <option value="ta">Tamil</option>
            </select>
          </div>
          <button onClick={handleSaveProfile} disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-800 disabled:opacity-50">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Profile
          </button>
        </div>
      </div>

      {/* Farmer Profile */}
      {role === "FARMER" && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30"><Globe size={18} className="text-amber-700 dark:text-amber-400" /></div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Farmer Details</h2>
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Village</label>
                <input value={village} onChange={e => setVillage(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">District</label>
                <input value={district} onChange={e => setDistrict(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">State</label>
                <input value={state} onChange={e => setState(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Land Area (Acres)</label>
                <input type="number" value={landAreaAcres} onChange={e => setLandAreaAcres(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400" />
              </div>
            </div>
            <button onClick={handleSaveFarmerProfile} disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-amber-800 disabled:opacity-50">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Farmer Details
            </button>
          </div>
        </div>
      )}

      {/* Vendor Profile */}
      {role === "VENDOR" && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30"><Shield size={18} className="text-blue-700 dark:text-blue-400" /></div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Business Details</h2>
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Business Name</label>
                <input value={businessName} onChange={e => setBusinessName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">GST Number</label>
                <input value={gstNumber} onChange={e => setGstNumber(e.target.value)} placeholder="22AAAAA0000A1Z5"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">PAN Number</label>
                <input value={panNumber} onChange={e => setPanNumber(e.target.value)} placeholder="AAAAA0000A"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400" />
              </div>
            </div>
            <button onClick={handleSaveVendorProfile} disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-blue-800 disabled:opacity-50">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Business Details
            </button>
          </div>
        </div>
      )}

      {/* Account Section — with Change Phone */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50"><Phone size={18} className="text-gray-700 dark:text-gray-200 dark:text-gray-200" /></div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Account</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{user?.role}</p>
          </div>
        </div>

        {/* Phone number row */}
        <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-3 mb-2">
          <div className="flex items-center gap-2">
            <Smartphone size={16} className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-200 dark:text-gray-200">+91 {displayCurrentPhone}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                {user?.isPhoneVerified ? "Verified" : "Not verified"}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (!showChangePhone) resetChangePhone();
              setShowChangePhone(!showChangePhone);
            }}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 transition-colors"
          >
            {showChangePhone ? "Cancel" : "Change"}
          </button>
        </div>

        {/* Change Phone flow */}
        {showChangePhone && (
          <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30 p-4">
            {changePhoneStep === "input" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    New Phone Number
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="Enter 10-digit number"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendOtp();
                      }}
                      className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSendOtp}
                    disabled={isSendingOtp || newPhone.replace(/\D/g, "").length !== 10}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm dark:shadow-gray-950/30 transition-all hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSendingOtp ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <ArrowRight size={15} />
                    )}
                    Send OTP
                  </button>
                  <button
                    onClick={resetChangePhone}
                    className="btn-ghost rounded-lg px-4 py-2.5 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {changePhoneStep === "otp" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">Verify new number</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      OTP sent to +91 {newPhone.replace(/(\d{5})(\d{5})/, "$1 $2")}
                    </p>
                  </div>
                  <button
                    onClick={() => setChangePhoneStep("input")}
                    className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-200"
                  >
                    <ArrowLeft size={12} />
                    Edit
                  </button>
                </div>

                {/* OTP Input */}
                <div className="flex items-center justify-center gap-2">
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={setInputRef(index)}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => {
                        handleOtpKeyDown(index, e);
                        if (e.key === "Enter" && otp.length === 6) {
                          handleVerifyOtp();
                        }
                      }}
                      className="h-12 w-10 rounded-lg border-2 text-center text-lg font-bold outline-none transition-all focus:border-emerald-600 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
                      style={{
                        backgroundColor: digit ? "#f0fdf4" : "#f9fafb",
                        borderColor: digit ? "#059669" : "#d1d5db",
                      }}
                      aria-label={`Digit ${index + 1}`}
                    />
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleVerifyOtp}
                    disabled={isVerifyingOtp || otp.length !== 6}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm dark:shadow-gray-950/30 transition-all hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isVerifyingOtp ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    Verify & Update
                  </button>
                  <button
                    onClick={handleSendOtp}
                    disabled={isSendingOtp}
                    className="btn-ghost rounded-lg px-4 py-2.5 text-sm"
                  >
                    {isSendingOtp ? (
                      <Loader2 size={15} className="animate-spin mr-1.5" />
                    ) : null}
                    Resend OTP
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status rows */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className={user?.isPhoneVerified ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500"} />
              <span className="text-sm text-gray-700 dark:text-gray-200 dark:text-gray-200">Phone Verified</span>
            </div>
            <span className="text-sm font-medium">{user?.isPhoneVerified ? "✅ Yes" : "❌ No"}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-200 dark:text-gray-200">Email</span>
            </div>
            <span className="text-sm font-medium">{user?.email ?? "Not set"}</span>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/30 dark:bg-purple-900/30"><Download size={18} className="text-purple-700 dark:text-purple-400" /></div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Data & Privacy</h2>
        </div>
        <div className="space-y-3">
          <button onClick={handleExportData}
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 px-4 py-3 text-sm transition-colors hover:border-purple-200 hover:bg-purple-50 dark:bg-purple-900/30">
            <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">Export My Data</span>
            <Download size={16} className="text-purple-700 dark:text-purple-400" />
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Download all your data including profile, orders, khata, and reviews.</p>
        </div>
      </div>

      {/* Delete Account — Danger Zone */}
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30"><Trash2 size={18} className="text-red-600 dark:text-red-400" /></div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Danger Zone</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Irreversible actions</p>
          </div>
        </div>

        {!showDeleteConfirm ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 px-4 py-3">
              <div className="flex items-center gap-3">
                <AlertTriangle size={16} className="text-red-500 dark:text-red-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">Delete your account</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">All your data will be permanently removed</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm dark:shadow-gray-950/30 transition-all hover:bg-red-700"
              >
                <Trash2 size={14} />
                Delete Account
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800">Are you absolutely sure?</p>
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  This action cannot be undone. All your account data including
                  profile, orders, khata records, and reviews will be permanently deleted.
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Type <span className="font-bold text-red-600 dark:text-red-400">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-red-500/20"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmText !== "DELETE"}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm dark:shadow-gray-950/30 transition-all hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Trash2 size={15} />
                )}
                {isDeleting ? "Deleting..." : "Permanently Delete My Account"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                disabled={isDeleting}
                className="btn-ghost rounded-lg px-4 py-2.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
