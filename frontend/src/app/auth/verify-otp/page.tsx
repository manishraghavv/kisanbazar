"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import {
  Languages,
  Sprout,
  ShieldCheck,
  Loader2,
  ArrowLeft,
  Headphones,
  Smartphone,
} from "lucide-react";

// ─── i18n dictionary ──────────────────────────────────────────────────────────

const dictionary = {
  hi: {
    title: "फ़ोन सत्यापित करें",
    subtitle: "अपने फ़ोन पर भेजा गया 6 अंकों का OTP दर्ज करें",
    otpSent: "हमने भेजा है",
    otpTo: "पर एक OTP",
    didntReceive: "OTP नहीं मिला?",
    resend: "पुनः भेजें",
    resendIn: "पुनः भेजें",
    verify: "सत्यापित करें",
    verifying: "सत्यापित हो रहा है...",
    success: "फ़ोन सत्यापित! अब लॉग इन करें।",
    error: "OTP सत्यापित नहीं हुआ। कृपया पुनः प्रयास करें।",
    resendSuccess: "OTP पुनः भेज दिया गया है!",
    resendError: "OTP पुनः भेजने में विफल। कृपया पुनः प्रयास करें।",
    backToLogin: "लॉग इन पर वापस जाएं",
    tagline: "किसानों और विक्रेताओं को जोड़ता है",
    taglineDesc:
      "डिजिटल एग्री-कॉमर्स के साथ ग्रामीण भारत को सशक्त बनाना — एक ही जगह पर खरीदें, बेचें और क्रेडिट प्रबंधित करें।",
    seconds: "सेकंड",
  },
  en: {
    title: "Verify your phone",
    subtitle: "Enter the 6-digit OTP sent to your phone",
    otpSent: "We've sent a",
    otpTo: "OTP to",
    didntReceive: "Didn't receive the code?",
    resend: "Resend",
    resendIn: "Resend in",
    verify: "Verify",
    verifying: "Verifying...",
    success: "Phone verified! You can now log in.",
    error: "OTP verification failed. Please try again.",
    resendSuccess: "OTP resent successfully!",
    resendError: "Failed to resend OTP. Please try again.",
    backToLogin: "Back to login",
    tagline: "Connecting Farmers & Vendors",
    taglineDesc:
      "Empowering rural India with digital agri-commerce — buy, sell, and manage credit all in one place.",
    seconds: "s",
  },
};

type Locale = keyof typeof dictionary;

const RESEND_COOLDOWN = 30; // seconds

// ─── Stats data ───────────────────────────────────────────────────────────────

const stats = [
  { value: "10,000+", label: "Farmers" },
  { value: "500+", label: "Vendors" },
  { value: "2,000+", label: "Products" },
  { value: "12", label: "States" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VerifyOtpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phoneParam = searchParams.get("phone") ?? "";

  const { verifyOtp, resendOtp } = useAuthStore();
  const [locale, setLocale] = useState<Locale>("hi");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const text = dictionary[locale];

  // 6-digit OTP state
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Set input refs
  const setInputRef = useCallback(
    (index: number) => (el: HTMLInputElement | null) => {
      inputRefs.current[index] = el;
    },
    [],
  );

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleDigitChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      // Move back on backspace
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);

    // Focus the next empty or last input
    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const otp = digits.join("");

  const handleVerify = async () => {
    if (otp.length !== 6) return;

    setIsSubmitting(true);
    try {
      await verifyOtp(phoneParam, otp);
      toast.success(text.success);
      router.push("/auth/login");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const message = axiosError.response?.data?.message ?? text.error;
      toast.error(message);
      // Clear OTP inputs on failure
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !phoneParam) return;

    setIsResending(true);
    try {
      await resendOtp(phoneParam);
      toast.success(text.resendSuccess);
      setResendCooldown(RESEND_COOLDOWN);
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const message = axiosError.response?.data?.message ?? text.resendError;
      toast.error(message);
    } finally {
      setIsResending(false);
    }
  };

  const toggleLocale = () => setLocale((prev) => (prev === "hi" ? "en" : "hi"));

  // Format phone for display
  const displayPhone = phoneParam.replace(/(\d{5})(\d{5})/, "$1 $2");

  return (
    <div
      className="flex min-h-screen"
      style={{ backgroundColor: "#f7faf5", color: "#191c1a" }}
    >
      {/* ── Left Panel ── */}
      <aside className="hidden w-[420px] shrink-0 flex-col overflow-hidden p-10 relative lg:flex">
        <div className="absolute inset-0" style={{ backgroundColor: "#006a34" }} />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative z-10 mb-10 flex items-center gap-3">
          <Sprout size={36} style={{ color: "#9af7af" }} />
          <h1 className="text-xl font-bold tracking-tight text-white">
            Kisaan Bazaar
          </h1>
        </div>
        <div className="relative z-10 mb-10 mt-auto">
          <h2 className="mb-4 text-3xl font-bold leading-tight text-white">
            {text.tagline}
          </h2>
          <p
            className="text-base leading-relaxed"
            style={{ color: "#7eda95", opacity: 0.9 }}
          >
            {text.taglineDesc}
          </p>
        </div>
        <div className="relative z-10 mb-10 grid grid-cols-2 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border p-4"
              style={{
                backgroundColor: "#268549",
                borderColor: "rgba(255,255,255,0.1)",
              }}
            >
              <p className="mb-1 text-2xl font-semibold text-white">{s.value}</p>
              <p
                className="text-xs uppercase tracking-widest"
                style={{ opacity: 0.8, color: "#7eda95" }}
              >
                {s.label}
              </p>
            </div>
          ))}
        </div>
        <div
          className="relative z-10 border-t pt-6"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            © 2025 Kisaan Bazaar. Rooted in Trust.
          </p>
        </div>
      </aside>

      {/* ── Right Panel ── */}
      <main
        className="relative flex flex-1 flex-col items-center justify-center px-4 md:px-16"
        style={{ backgroundColor: "#f7faf5" }}
      >
        {/* Language toggle — desktop top-right */}
        <div className="absolute right-6 top-6 hidden lg:flex">
          <button
            onClick={toggleLocale}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
            style={{ color: "#3f4940" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#e6e9e4")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <Languages size={18} />
            {locale === "hi" ? "EN" : "हिं"}
          </button>
        </div>

        {/* Mobile brand bar */}
        <div className="mb-10 flex w-full max-w-[440px] items-center justify-between lg:hidden">
          <div className="flex items-center gap-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl shadow"
              style={{ backgroundColor: "#006a34" }}
            >
              <Sprout size={20} color="#ffffff" />
            </div>
            <span className="text-base font-bold" style={{ color: "#006a34" }}>
              Kisaan Bazaar
            </span>
          </div>
          <button
            onClick={toggleLocale}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{ color: "#3f4940" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#e6e9e4")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <Languages size={14} />
            {locale === "hi" ? "EN" : "हिं"}
          </button>
        </div>

        {/* Form card */}
        <section className="w-full max-w-[440px]">
          <header className="mb-8 text-center">
            {/* Phone icon */}
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 shadow-sm dark:shadow-gray-950/30">
              <Smartphone size={32} style={{ color: "#006a34" }} />
            </div>

            <h2
              className="mb-2 text-2xl font-bold md:text-3xl"
              style={{ color: "#191c1a" }}
            >
              {text.title}
            </h2>
            <p className="text-base" style={{ color: "#3f4940" }}>
              {text.subtitle}
            </p>
          </header>

          {/* Phone display */}
          {phoneParam && (
            <div className="mb-8 text-center">
              <p className="text-sm" style={{ color: "#3f4940" }}>
                {text.otpSent}{" "}
                <span className="font-semibold" style={{ color: "#006a34" }}>
                  {text.otpTo}
                </span>
              </p>
              <p className="mt-1 text-xl font-bold tracking-wide" style={{ color: "#191c1a" }}>
                +91 {displayPhone}
              </p>
            </div>
          )}

          {/* OTP Input */}
          <div className="mb-8">
            <div
              className="flex items-center justify-center gap-3"
              onPaste={handlePaste}
            >
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
                    if (e.key === "Enter" && otp.length === 6) {
                      handleVerify();
                    }
                  }}
                  className="h-14 w-12 rounded-xl border-2 text-center text-2xl font-bold outline-none transition-all md:h-16 md:w-14"
                  style={{
                    backgroundColor: digit ? "#f0fdf4" : "#f1f4ef",
                    borderColor: digit ? "#006a34" : "#d1d5db",
                    color: "#191c1a",
                    caretColor: "#006a34",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#006a34";
                    e.target.style.boxShadow = "0 0 0 3px rgba(0,106,52,0.12)";
                  }}
                  onBlur={(e) => {
                    if (!digit) {
                      e.target.style.borderColor = "#d1d5db";
                    }
                    e.target.style.boxShadow = "none";
                  }}
                  aria-label={`Digit ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Verify button */}
          <button
            onClick={handleVerify}
            disabled={otp.length !== 6 || isSubmitting}
            className="relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-full text-sm font-bold tracking-wide shadow-lg dark:shadow-gray-950/30 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: "#006a34",
              color: "#ffffff",
              boxShadow: "0 4px 24px rgba(0,106,52,0.18)",
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {text.verifying}
              </>
            ) : (
              <>
                <ShieldCheck size={18} />
                {text.verify}
              </>
            )}
          </button>

          {/* Resend */}
          <div className="mt-8 text-center">
            <p className="text-sm" style={{ color: "#3f4940" }}>
              {text.didntReceive}
            </p>
            {resendCooldown > 0 ? (
              <p className="mt-1 text-sm font-medium" style={{ color: "#6f7a6f" }}>
                {text.resendIn}{" "}
                <span style={{ color: "#006a34" }}>{resendCooldown}</span>{" "}
                {text.seconds}
              </p>
            ) : (
              <button
                onClick={handleResend}
                disabled={isResending || !phoneParam}
                className="mt-1 flex items-center justify-center gap-1.5 text-sm font-semibold transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                style={{ color: "#006a34" }}
              >
                {isResending && <Loader2 size={14} className="animate-spin" />}
                {text.resend}
              </button>
            )}
          </div>

          {/* Back to login */}
          <div className="mt-8 text-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:underline"
              style={{ color: "#3f4940" }}
            >
              <ArrowLeft size={14} />
              {text.backToLogin}
            </Link>
          </div>
        </section>

        {/* Trust badges — desktop only */}
        <section
          className="mt-10 hidden w-full max-w-[440px] md:block"
          style={{ opacity: 0.6 }}
        >
          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "#fdc39a" }}
              >
                <ShieldCheck size={18} style={{ color: "#794e2e" }} />
              </div>
              <p className="text-xs leading-tight" style={{ color: "#3f4940" }}>
                Secure Payments<br />
                &amp; Data Privacy
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "#d4e3ff" }}
              >
                <Headphones size={18} style={{ color: "#001c39" }} />
              </div>
              <p className="text-xs leading-tight" style={{ color: "#3f4940" }}>
                24/7 Mandi Support
                <br />
                Call Toll Free
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
