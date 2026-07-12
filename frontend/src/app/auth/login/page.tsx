"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/stores/authStore";
import { loginSchema, type LoginFormValues } from "@/lib/validators";
import { toast } from "sonner";
import {
  LogIn, Languages, Sprout, Eye, EyeOff, Loader2,
  ShieldCheck, Headphones, Users, Store, Package, MapPin,
} from "lucide-react";

const dict = {
  hi: {
    title: "अपने खाते में लॉग इन करें",
    subtitle: "किसान बाज़ार में आपका स्वागत है",
    phone: "मोबाइल नंबर", phonePh: "10 अंकों का नंबर",
    password: "पासवर्ड", passwordPh: "अपना पासवर्ड दर्ज करें",
    forgot: "पासवर्ड भूल गए?",
    submit: "लॉग इन करें", submitting: "कृपया प्रतीक्षा करें...",
    noAccount: "खाता नहीं है?", register: "रजिस्टर करें",
    success: "लॉग इन सफल!", error: "फ़ोन नंबर या पासवर्ड गलत है",
    tagline: "किसानों और विक्रेताओं को जोड़ता है",
    taglineDesc: "डिजिटल एग्री-कॉमर्स के साथ ग्रामीण भारत को सशक्त बनाना — एक ही जगह पर खरीदें, बेचें और क्रेडिट प्रबंधित करें।",
  },
  en: {
    title: "Sign in to your account",
    subtitle: "Welcome back to Kisaan Bazaar",
    phone: "Mobile Number", phonePh: "10-digit mobile number",
    password: "Password", passwordPh: "Enter your password",
    forgot: "Forgot password?",
    submit: "Sign In", submitting: "Signing in...",
    noAccount: "Don't have an account?", register: "Register",
    success: "Login successful!", error: "Invalid phone number or password",
    tagline: "Connecting Farmers & Vendors",
    taglineDesc: "Empowering rural India with digital agri-commerce — buy, sell, and manage credit all in one place.",
  },
};
type Locale = keyof typeof dict;

const stats = [
  { value: "10,000+", label: { hi: "किसान",   en: "Farmers"  }, icon: Users   },
  { value: "500+",    label: { hi: "विक्रेता",  en: "Vendors"  }, icon: Store   },
  { value: "2,000+", label: { hi: "उत्पाद",   en: "Products" }, icon: Package },
  { value: "12",      label: { hi: "राज्य",    en: "States"   }, icon: MapPin  },
];

const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400";

const fieldWrapCls = (hasError: boolean) =>
  `flex items-center rounded-xl border bg-gray-50 dark:bg-gray-700/50 transition-all focus-within:bg-white dark:focus-within:bg-gray-700 focus-within:shadow-sm ${
    hasError
      ? "border-red-400 dark:border-red-500 focus-within:ring-2 focus-within:ring-red-400/20"
      : "border-gray-200 dark:border-gray-600 focus-within:border-emerald-500 dark:focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/20 dark:focus-within:ring-emerald-400/20"
  }`;

const inputCls =
  "w-full bg-transparent px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none";

export default function LoginPage() {
  const router = useRouter();
  const { login, getDashboardRoute } = useAuthStore();
  const [locale, setLocale] = useState<Locale>("hi");
  const [showPw, setShowPw] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = dict[locale];

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phoneNumber: "", password: "" },
  });

  const mergeGuestCart = async () => {
    try {
      const guestItems = localStorage.getItem("guest_cart_items");
      if (!guestItems) return;
      const items = JSON.parse(guestItems);
      if (!Array.isArray(items) || items.length === 0) { localStorage.removeItem("guest_cart_items"); return; }
      const { useCartStore } = await import("@/stores/cartStore");
      await useCartStore.getState().mergeCart(items);
      localStorage.removeItem("guest_cart_items");
    } catch { /* best-effort */ }
  };

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      await login(data.phoneNumber, data.password);
      await mergeGuestCart();
      toast.success(t.success);
      router.push(getDashboardRoute());
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white dark:bg-gray-900">

      {/* ── Left Panel ── */}
      <aside className="relative hidden w-[400px] shrink-0 overflow-hidden lg:flex lg:flex-col">
        {/* Emerald gradient — matches original emerald-700 brand */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-600" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_10%_20%,rgba(255,255,255,0.08)_0%,transparent_70%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="pointer-events-none absolute -bottom-16 -right-16 opacity-[0.05]">
          <Sprout size={320} className="text-white" strokeWidth={0.8} />
        </div>

        <div className="relative z-10 flex flex-1 flex-col px-10 py-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <Sprout size={22} className="text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">Kisaan Bazaar</span>
          </div>

          <div className="mt-auto">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-200">
              <Sprout size={11} /> Agri Commerce Platform
            </div>
            <h2 className="mb-4 text-3xl font-extrabold leading-tight text-white">{t.tagline}</h2>
            <p className="text-sm leading-relaxed text-emerald-100/80">{t.taglineDesc}</p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.value} className="rounded-2xl border border-white/10 bg-white/10 p-4 transition-all duration-200 hover:bg-white/15 hover:scale-[1.02]">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                    <Icon size={15} className="text-emerald-200" />
                  </div>
                  <p className="text-xl font-bold text-white">{s.value}</p>
                  <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-emerald-300/80">{s.label[locale]}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 space-y-3">
            {[
              { icon: ShieldCheck, text: locale === "hi" ? "सुरक्षित भुगतान और डेटा गोपनीयता" : "Secure Payments & Data Privacy" },
              { icon: Headphones, text: locale === "hi" ? "24/7 मंडी सहायता — टोल फ्री" : "24/7 Mandi Support — Toll Free" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon size={15} className="text-emerald-300" />
                </div>
                <p className="text-xs text-emerald-100/70">{text}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-[11px] text-white/30">© 2025 Kisaan Bazaar. Rooted in Trust.</p>
        </div>
      </aside>

      {/* ── Right Panel ── */}
      <main className="flex flex-1 flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-5 py-10 md:px-12">
        {/* Top bar */}
        <div className="mb-8 flex w-full max-w-[460px] items-center justify-between">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700">
              <Sprout size={18} className="text-white" />
            </div>
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Kisaan Bazaar</span>
          </div>
          <div className="hidden lg:block" />
          <button
            onClick={() => setLocale((p) => (p === "hi" ? "en" : "hi"))}
            className="flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
          >
            <Languages size={13} />
            {locale === "hi" ? "English" : "हिंदी"}
          </button>
        </div>

        {/* Card */}
        <div className="w-full max-w-[460px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
          <div className="h-1 w-full rounded-t-2xl bg-emerald-700" />

          <div className="p-7">
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{t.title}</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t.subtitle}</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Phone */}
              <div>
                <label htmlFor="phoneNumber" className={labelCls}>{t.phone}</label>
                <div className={fieldWrapCls(!!errors.phoneNumber)}>
                  <span className="shrink-0 border-r border-gray-200 dark:border-gray-600 py-3 pl-4 pr-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
                    🇮🇳 +91
                  </span>
                  <input
                    id="phoneNumber" type="tel" autoComplete="tel"
                    placeholder={t.phonePh} maxLength={10}
                    {...register("phoneNumber", {
                      onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10); },
                    })}
                    className={`${inputCls} px-3`}
                  />
                </div>
                {errors.phoneNumber && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.phoneNumber.message}</p>}
              </div>

              {/* Password */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className={`${labelCls} mb-0`}>{t.password}</label>
                  <Link href="/auth/forgot-password" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline underline-offset-2">
                    {t.forgot}
                  </Link>
                </div>
                <div className={`${fieldWrapCls(!!errors.password)} relative`}>
                  <input
                    id="password" type={showPw ? "text" : "password"}
                    autoComplete="current-password" placeholder={t.passwordPh}
                    {...register("password")} className={`${inputCls} pr-11`}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1}
                    className="absolute right-3 text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.password.message}</p>}
              </div>

              {/* Submit */}
              <button type="submit" disabled={isSubmitting}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-bold text-white shadow hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all">
                {isSubmitting
                  ? <><Loader2 size={16} className="animate-spin" />{t.submitting}</>
                  : <><LogIn size={16} />{t.submit}</>}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {t.noAccount}{" "}
              <Link href="/auth/register" className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline underline-offset-2">
                {t.register}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
