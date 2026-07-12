"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/stores/authStore";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/validators";
import { toast } from "sonner";
import {
  Languages,
  Sprout,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Headphones,
  ArrowLeft,
  KeyRound,
} from "lucide-react";

// ─── i18n dictionary ──────────────────────────────────────────────────────────

const dictionary = {
  hi: {
    title: "पासवर्ड रीसेट करें",
    subtitle: "OTP दर्ज करें और नया पासवर्ड सेट करें",
    otpLabel: "OTP",
    otpPlaceholder: "6 अंकों का OTP",
    newPasswordLabel: "नया पासवर्ड",
    newPasswordPlaceholder: "कम से कम 6 अक्षर",
    confirmPasswordLabel: "पासवर्ड की पुष्टि करें",
    confirmPasswordPlaceholder: "पासवर्ड फिर से दर्ज करें",
    reset: "पासवर्ड रीसेट करें",
    resetting: "रीसेट हो रहा है...",
    success: "पासवर्ड सफलतापूर्वक रीसेट! कृपया लॉग इन करें।",
    error: "पासवर्ड रीसेट विफल। कृपया पुनः प्रयास करें।",
    backToLogin: "लॉग इन पर वापस जाएं",
    tagline: "किसानों और विक्रेताओं को जोड़ता है",
    taglineDesc:
      "डिजिटल एग्री-कॉमर्स के साथ ग्रामीण भारत को सशक्त बनाना — एक ही जगह पर खरीदें, बेचें और क्रेडिट प्रबंधित करें।",
    securePayments: "सुरक्षित भुगतान और डेटा गोपनीयता",
    support247: "24/7 मंडी सहायता — टोल फ्री कॉल",
  },
  en: {
    title: "Reset password",
    subtitle: "Enter the OTP and set a new password",
    otpLabel: "OTP",
    otpPlaceholder: "6-digit OTP",
    newPasswordLabel: "New Password",
    newPasswordPlaceholder: "At least 6 characters",
    confirmPasswordLabel: "Confirm Password",
    confirmPasswordPlaceholder: "Re-enter your password",
    reset: "Reset Password",
    resetting: "Resetting...",
    success: "Password reset successful! Please log in.",
    error: "Password reset failed. Please try again.",
    backToLogin: "Back to login",
    tagline: "Connecting Farmers & Vendors",
    taglineDesc:
      "Empowering rural India with digital agri-commerce — buy, sell, and manage credit all in one place.",
    securePayments: "Secure Payments &amp; Data Privacy",
    support247: "24/7 Mandi Support — Call Toll Free",
  },
};

type Locale = keyof typeof dictionary;

// ─── Stats data ───────────────────────────────────────────────────────────────

const stats = [
  { value: "10,000+", label: "Farmers" },
  { value: "500+", label: "Vendors" },
  { value: "2,000+", label: "Products" },
  { value: "12", label: "States" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phoneParam = searchParams.get("phone") ?? "";
  const displayPhone = phoneParam.replace(/(\d{5})(\d{5})/, "$1 $2");

  const { resetPassword } = useAuthStore();
  const [locale, setLocale] = useState<Locale>("hi");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const text = dictionary[locale];

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { otp: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    if (!phoneParam) {
      toast.error("No phone number provided. Please start from forgot password.");
      return;
    }
    setIsSubmitting(true);
    try {
      await resetPassword(phoneParam, data.otp, data.newPassword);
      toast.success(text.success);
      router.push("/auth/login");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const message = axiosError.response?.data?.message ?? text.error;
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── OTP digit input state ──────────────────────────────────────────────────
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const setInputRef = useCallback((index: number) => (el: HTMLInputElement | null) => {
    inputRefs.current[index] = el;
  }, []);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  const handleDigitChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);
    setValue("otp", newDigits.join(""), { shouldValidate: true });
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i];
    setDigits(newDigits);
    setValue("otp", newDigits.join(""), { shouldValidate: true });
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const toggleLocale = () => setLocale((prev) => (prev === "hi" ? "en" : "hi"));

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#f7faf5", color: "#191c1a" }}>
      {/* ── Left Panel ── */}
      <aside className="hidden w-[420px] shrink-0 flex-col overflow-hidden p-10 relative lg:flex">
        <div className="absolute inset-0" style={{ backgroundColor: "#006a34" }} />
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div className="relative z-10 mb-10 flex items-center gap-3">
          <Sprout size={36} style={{ color: "#9af7af" }} />
          <h1 className="text-xl font-bold tracking-tight text-white">Kisaan Bazaar</h1>
        </div>
        <div className="relative z-10 mb-10 mt-auto">
          <h2 className="mb-4 text-3xl font-bold leading-tight text-white">{text.tagline}</h2>
          <p className="text-base leading-relaxed" style={{ color: "#7eda95", opacity: 0.9 }}>{text.taglineDesc}</p>
        </div>
        <div className="relative z-10 mb-10 grid grid-cols-2 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border p-4" style={{ backgroundColor: "#268549", borderColor: "rgba(255,255,255,0.1)" }}>
              <p className="mb-1 text-2xl font-semibold text-white">{s.value}</p>
              <p className="text-xs uppercase tracking-widest" style={{ opacity: 0.8, color: "#7eda95" }}>{s.label}</p>
            </div>
          ))}
        </div>
        <div className="relative z-10 border-t pt-6" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>© 2025 Kisaan Bazaar. Rooted in Trust.</p>
        </div>
      </aside>

      {/* ── Right Panel ── */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-8 md:px-16" style={{ backgroundColor: "#f7faf5" }}>
        {/* Language toggle */}
        <div className="absolute right-6 top-6 hidden lg:flex">
          <button onClick={toggleLocale} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors" style={{ color: "#3f4940" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e6e9e4")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
            <Languages size={18} />{locale === "hi" ? "EN" : "हिं"}
          </button>
        </div>
        <div className="mb-6 flex w-full max-w-[440px] items-center justify-between lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl shadow" style={{ backgroundColor: "#006a34" }}>
              <Sprout size={20} color="#ffffff" />
            </div>
            <span className="text-base font-bold" style={{ color: "#006a34" }}>Kisaan Bazaar</span>
          </div>
          <button onClick={toggleLocale} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors" style={{ color: "#3f4940" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e6e9e4")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
            <Languages size={14} />{locale === "hi" ? "EN" : "हिं"}
          </button>
        </div>

        <section className="w-full max-w-[440px]">
          <header className="mb-8 text-center md:text-left">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 shadow-sm dark:shadow-gray-950/30 md:mx-0">
              <KeyRound size={32} style={{ color: "#006a34" }} />
            </div>
            <h2 className="mb-2 text-2xl font-bold md:text-3xl" style={{ color: "#191c1a" }}>{text.title}</h2>
            <p className="text-base" style={{ color: "#3f4940" }}>{text.subtitle}</p>
            {phoneParam && (
              <p className="mt-2 text-sm font-medium" style={{ color: "#006a34" }}>+91 {displayPhone}</p>
            )}
          </header>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* OTP Input */}
            <div className="space-y-2">
              <p className="text-sm font-semibold tracking-wide" style={{ color: "#3f4940" }}>{text.otpLabel}</p>
              <div className="flex items-center justify-center gap-3" onPaste={handlePaste}>
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
                      handleKeyDown(index, e);
                      if (e.key === "Enter") handleSubmit(onSubmit)();
                    }}
                    className="h-14 w-12 rounded-xl border-2 text-center text-2xl font-bold outline-none transition-all md:h-16 md:w-14"
                    style={{ backgroundColor: digit ? "#f0fdf4" : "#f1f4ef", borderColor: digit ? "#006a34" : "#d1d5db", color: "#191c1a", caretColor: "#006a34" }}
                    onFocus={(e) => { e.target.style.borderColor = "#006a34"; e.target.style.boxShadow = "0 0 0 3px rgba(0,106,52,0.12)"; }}
                    onBlur={(e) => { if (!digit) e.target.style.borderColor = "#d1d5db"; e.target.style.boxShadow = "none"; }}
                    aria-label={`Digit ${index + 1}`}
                  />
                ))}
              </div>
              {errors.otp && <p className="text-sm text-red-600 dark:text-red-400 text-center">{errors.otp.message}</p>}
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label htmlFor="newPassword" className="text-sm font-semibold tracking-wide" style={{ color: "#3f4940" }}>{text.newPasswordLabel}</label>
              <div className="relative flex items-center rounded-t-lg transition-all" style={{ backgroundColor: "#f1f4ef", borderBottom: errors.newPassword ? "2px solid #dc2626" : "2px solid #becabd" }}>
                <input id="newPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder={text.newPasswordPlaceholder} {...register("newPassword")}
                  className="w-full border-none bg-transparent px-4 py-3.5 text-base outline-none pr-12" style={{ color: "#191c1a" }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 transition-colors" style={{ color: "#6f7a6f" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#006a34")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#6f7a6f")} tabIndex={-1}>
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.newPassword && <p className="text-sm text-red-600 dark:text-red-400">{errors.newPassword.message}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-semibold tracking-wide" style={{ color: "#3f4940" }}>{text.confirmPasswordLabel}</label>
              <div className="relative flex items-center rounded-t-lg transition-all" style={{ backgroundColor: "#f1f4ef", borderBottom: errors.confirmPassword ? "2px solid #dc2626" : "2px solid #becabd" }}>
                <input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" placeholder={text.confirmPasswordPlaceholder} {...register("confirmPassword")}
                  className="w-full border-none bg-transparent px-4 py-3.5 text-base outline-none pr-12" style={{ color: "#191c1a" }} />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 transition-colors" style={{ color: "#6f7a6f" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#006a34")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#6f7a6f")} tabIndex={-1}>
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-sm text-red-600 dark:text-red-400">{errors.confirmPassword.message}</p>}
            </div>

            {/* Submit */}
            <button type="submit" disabled={isSubmitting}
              className="relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-full text-sm font-bold tracking-wide shadow-lg dark:shadow-gray-950/30 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
              style={{ backgroundColor: "#006a34", color: "#ffffff", boxShadow: "0 4px 24px rgba(0,106,52,0.18)" }}>
              {isSubmitting ? <><Loader2 size={18} className="animate-spin" />{text.resetting}</> : <><KeyRound size={18} />{text.reset}</>}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:underline" style={{ color: "#3f4940" }}>
              <ArrowLeft size={14} />{text.backToLogin}
            </Link>
          </div>
        </section>

        {/* Trust badges */}
        <section className="mt-10 hidden w-full max-w-[440px] md:block" style={{ opacity: 0.6 }}>
          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "#fdc39a" }}>
                <ShieldCheck size={18} style={{ color: "#794e2e" }} />
              </div>
              <p className="text-xs leading-tight" style={{ color: "#3f4940" }}>Secure Payments<br />&amp; Data Privacy</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "#d4e3ff" }}>
                <Headphones size={18} style={{ color: "#001c39" }} />
              </div>
              <p className="text-xs leading-tight" style={{ color: "#3f4940" }}>24/7 Mandi Support<br />Call Toll Free</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
