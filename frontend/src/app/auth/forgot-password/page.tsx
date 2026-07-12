"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/stores/authStore";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/validators";
import { toast } from "sonner";
import {
  Languages,
  Sprout,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  Headphones,
  KeyRound,
} from "lucide-react";

// ─── i18n dictionary ──────────────────────────────────────────────────────────

const dictionary = {
  hi: {
    title: "पासवर्ड भूल गए?",
    subtitle: "अपना मोबाइल नंबर दर्ज करें, हम एक OTP भेजेंगे",
    phoneLabel: "मोबाइल नंबर",
    phonePlaceholder: "10 अंकों का मोबाइल नंबर",
    sendOtp: "OTP भेजें",
    sending: "भेज रहा है...",
    success:
      "यदि यह नंबर पंजीकृत है, तो एक OTP भेज दिया गया है।",
    error: "कुछ गलत हो गया। कृपया पुनः प्रयास करें।",
    backToLogin: "लॉग इन पर वापस जाएं",
    tagline: "किसानों और विक्रेताओं को जोड़ता है",
    taglineDesc:
      "डिजिटल एग्री-कॉमर्स के साथ ग्रामीण भारत को सशक्त बनाना — एक ही जगह पर खरीदें, बेचें और क्रेडिट प्रबंधित करें।",
    securePayments: "सुरक्षित भुगतान और डेटा गोपनीयता",
    support247: "24/7 मंडी सहायता — टोल फ्री कॉल",
  },
  en: {
    title: "Forgot password?",
    subtitle: "Enter your mobile number and we'll send an OTP",
    phoneLabel: "Mobile Number",
    phonePlaceholder: "10-digit mobile number",
    sendOtp: "Send OTP",
    sending: "Sending...",
    success:
      "If this number is registered, an OTP has been sent.",
    error: "Something went wrong. Please try again.",
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

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { forgotPassword } = useAuthStore();
  const [locale, setLocale] = useState<Locale>("hi");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const text = dictionary[locale];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { phoneNumber: "" },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsSubmitting(true);
    try {
      await forgotPassword(data.phoneNumber);
      toast.success(text.success);
      router.push(`/auth/reset-password?phone=${data.phoneNumber}`);
    } catch {
      toast.error(text.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLocale = () => setLocale((prev) => (prev === "hi" ? "en" : "hi"));

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
            backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative z-10 mb-10 flex items-center gap-3">
          <Sprout size={36} style={{ color: "#9af7af" }} />
          <h1 className="text-xl font-bold tracking-tight text-white">Kisaan Bazaar</h1>
        </div>
        <div className="relative z-10 mb-10 mt-auto">
          <h2 className="mb-4 text-3xl font-bold leading-tight text-white">{text.tagline}</h2>
          <p className="text-base leading-relaxed" style={{ color: "#7eda95", opacity: 0.9 }}>
            {text.taglineDesc}
          </p>
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
      <main className="relative flex flex-1 flex-col items-center justify-center px-4 md:px-16" style={{ backgroundColor: "#f7faf5" }}>
        {/* Language toggle */}
        <div className="absolute right-6 top-6 hidden lg:flex">
          <button onClick={toggleLocale} className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors" style={{ color: "#3f4940" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e6e9e4")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
            <Languages size={18} />
            {locale === "hi" ? "EN" : "हिं"}
          </button>
        </div>

        {/* Mobile brand */}
        <div className="mb-10 flex w-full max-w-[440px] items-center justify-between lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl shadow" style={{ backgroundColor: "#006a34" }}>
              <Sprout size={20} color="#ffffff" />
            </div>
            <span className="text-base font-bold" style={{ color: "#006a34" }}>Kisaan Bazaar</span>
          </div>
          <button onClick={toggleLocale} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors" style={{ color: "#3f4940" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e6e9e4")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
            <Languages size={14} />
            {locale === "hi" ? "EN" : "हिं"}
          </button>
        </div>

        {/* Form card */}
        <section className="w-full max-w-[440px]">
          <header className="mb-8 text-center md:text-left">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 shadow-sm dark:shadow-gray-950/30 md:mx-0">
              <KeyRound size={32} style={{ color: "#006a34" }} />
            </div>
            <h2 className="mb-2 text-2xl font-bold md:text-3xl" style={{ color: "#191c1a" }}>
              {text.title}
            </h2>
            <p className="text-base" style={{ color: "#3f4940" }}>{text.subtitle}</p>
          </header>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="phoneNumber" className="text-sm font-semibold tracking-wide" style={{ color: "#3f4940" }}>
                {text.phoneLabel}
              </label>
              <div className="flex items-center rounded-t-lg transition-all" style={{ backgroundColor: "#f1f4ef", borderBottom: errors.phoneNumber ? "2px solid #dc2626" : "2px solid #becabd" }}>
                <span className="border-r py-4 pl-4 pr-3 text-base font-medium select-none" style={{ color: "#3f4940", borderColor: "#becabd" }}>+91</span>
                <input
                  id="phoneNumber"
                  type="tel"
                  autoComplete="tel"
                  placeholder={text.phonePlaceholder}
                  maxLength={10}
                  {...register("phoneNumber", { onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10); } })}
                  className="w-full border-none bg-transparent px-3 py-4 text-base outline-none"
                  style={{ color: "#191c1a" }}
                />
              </div>
              {errors.phoneNumber && <p className="text-sm text-red-600 dark:text-red-400">{errors.phoneNumber.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-full text-sm font-bold tracking-wide shadow-lg dark:shadow-gray-950/30 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
              style={{ backgroundColor: "#006a34", color: "#ffffff", boxShadow: "0 4px 24px rgba(0,106,52,0.18)" }}
            >
              {isSubmitting ? (
                <><Loader2 size={18} className="animate-spin" />{text.sending}</>
              ) : (
                <><KeyRound size={18} />{text.sendOtp}</>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors hover:underline" style={{ color: "#3f4940" }}>
              <ArrowLeft size={14} />
              {text.backToLogin}
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
