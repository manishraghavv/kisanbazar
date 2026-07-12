"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUiStore } from "@/stores/uiStore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/stores/authStore";
import { registerSchema, type RegisterFormValues } from "@/lib/validators";
import { toast } from "sonner";
import {
  Languages, Sprout, Eye, EyeOff, Loader2, UserPlus,
  ShieldCheck, Headphones, Wheat, Store, ArrowRight,
  ArrowLeft, CheckCircle2, Users, Package, MapPin,
  Sun, Moon, Monitor,
} from "lucide-react";

const dict = {
  hi: {
    title1: "अपना परिचय दें",     subtitle1: "बुनियादी जानकारी भरें",
    title2: "खाता सुरक्षित करें", subtitle2: "एक मजबूत पासवर्ड बनाएं",
    fullName: "पूरा नाम", fullNamePh: "अपना पूरा नाम दर्ज करें",
    phone: "मोबाइल नंबर", phonePh: "10 अंकों का नंबर",
    email: "ईमेल (वैकल्पिक)", emailPh: "ईमेल पता",
    referral: "रेफरल कोड (वैकल्पिक)", referralPh: "रेफरल कोड",
    password: "पासवर्ड", passwordPh: "कम से कम 6 अक्षर",
    confirm: "पासवर्ड की पुष्टि", confirmPh: "पासवर्ड दोहराएं",
    selectRole: "आप किस रूप में शामिल हों?",
    farmer: "किसान", farmerDesc: "उर्वरक, बीज, उपकरण खरीदें और खाता प्रबंधित करें",
    vendor: "विक्रेता", vendorDesc: "उत्पाद बेचें, स्टॉक प्रबंधित करें और ऑर्डर पूरे करें",
    next: "आगे बढ़ें", back: "वापस",
    submit: "खाता बनाएं", submitting: "कृपया प्रतीक्षा करें...",
    haveAccount: "पहले से खाता है?", login: "लॉग इन करें",
    success: "रजिस्ट्रेशन सफल! ओटीपी सत्यापित करें।",
    error: "रजिस्ट्रेशन विफल। कृपया पुनः प्रयास करें।",
    tagline: "किसानों और विक्रेताओं को जोड़ता है",
    taglineDesc: "डिजिटल एग्री-कॉमर्स के साथ ग्रामीण भारत को सशक्त बनाना — एक ही जगह पर खरीदें, बेचें और क्रेडिट प्रबंधित करें।",
    step: "चरण",
  },
  en: {
    title1: "Tell us about you",     subtitle1: "Fill in your basic information",
    title2: "Secure your account",  subtitle2: "Create a strong password",
    fullName: "Full Name", fullNamePh: "Enter your full name",
    phone: "Mobile Number", phonePh: "10-digit mobile number",
    email: "Email (optional)", emailPh: "Enter your email address",
    referral: "Referral Code (optional)", referralPh: "Enter referral code",
    password: "Password", passwordPh: "At least 6 characters",
    confirm: "Confirm Password", confirmPh: "Re-enter your password",
    selectRole: "How would you like to join?",
    farmer: "Farmer", farmerDesc: "Buy seeds, fertilizers & manage Khata credit",
    vendor: "Vendor", vendorDesc: "Sell products, manage stock & fulfill orders",
    next: "Continue", back: "Back",
    submit: "Create Account", submitting: "Creating account...",
    haveAccount: "Already have an account?", login: "Sign in",
    success: "Registration successful! Please verify your OTP.",
    error: "Registration failed. Please try again.",
    tagline: "Connecting Farmers & Vendors",
    taglineDesc: "Empowering rural India with digital agri-commerce — buy, sell, and manage credit all in one place.",
    step: "Step",
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

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser } = useAuthStore();
  const { theme, toggleTheme } = useUiStore();
  const [locale, setLocale] = useState<Locale>("hi");
  const [step, setStep] = useState<1 | 2>(1);
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = dict[locale];

  const { register, handleSubmit, setValue, watch, trigger, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", phoneNumber: "", email: "", password: "", confirmPassword: "", role: undefined, referralCode: "" },
    mode: "onTouched",
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedRole = watch("role");

  const goToStep2 = async () => {
    const ok = await trigger(["role", "fullName", "phoneNumber", "email"]);
    if (ok) setStep(2);
  };

  const onSubmit = async (data: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await registerUser({
        fullName: data.fullName, phoneNumber: data.phoneNumber,
        email: data.email || undefined, password: data.password,
        role: data.role, referralCode: data.referralCode || undefined,
        languagePref: locale,
      });
      toast.success(t.success);
      router.push(`/auth/verify-otp?phone=${result.phoneNumber}`);
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
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-600" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_10%_20%,rgba(255,255,255,0.08)_0%,transparent_70%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="pointer-events-none absolute -bottom-16 -right-16 opacity-[0.05]">
          <Wheat size={320} className="text-white" strokeWidth={0.8} />
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
            <h2 className="mb-3 text-3xl font-extrabold leading-tight text-white">{t.tagline}</h2>
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
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={`Theme: ${theme}`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
            >
              {theme === "light" ? <Sun size={14} /> : theme === "dark" ? <Moon size={14} /> : <Monitor size={14} />}
            </button>
            {/* Locale toggle */}
            <button
              onClick={() => setLocale((p) => (p === "hi" ? "en" : "hi"))}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
            >
              <Languages size={13} />
              {locale === "hi" ? "English" : "हिंदी"}
            </button>
          </div>
        </div>

        {/* Card */}
        <div className="w-full max-w-[460px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
          {/* Progress bar */}
          <div className="flex overflow-hidden rounded-t-2xl">
            <div className="h-1 flex-1 bg-emerald-700 transition-all duration-300" />
            <div className={`h-1 flex-1 transition-all duration-300 ${step === 2 ? "bg-emerald-700" : "bg-gray-200 dark:bg-gray-700"}`} />
          </div>

          <div className="p-7">
            <div className="mb-6">
              <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                {t.step} {step} / 2
              </span>
              <h1 className="mt-1 text-2xl font-extrabold text-gray-900 dark:text-gray-100">
                {step === 1 ? t.title1 : t.title2}
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {step === 1 ? t.subtitle1 : t.subtitle2}
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
              {/* ── Step 1 ── */}
              {step === 1 && (
                <div className="space-y-5">
                  {/* Role selector */}
                  <div>
                    <p className={labelCls}>{t.selectRole}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {(["FARMER", "VENDOR"] as const).map((role) => {
                        const isSelected = selectedRole === role;
                        const Icon = role === "FARMER" ? Wheat : Store;
                        const iconBg = role === "FARMER"
                          ? isSelected ? "bg-emerald-700 text-white" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                          : isSelected ? "bg-emerald-700 text-white" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400";
                        return (
                          <button key={role} type="button"
                            onClick={() => setValue("role", role, { shouldValidate: true })}
                            className={`relative flex flex-col items-start gap-3 rounded-xl border-2 p-4 text-left transition-all duration-150 ${
                              isSelected
                                ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm"
                                : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/30 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                            }`}
                          >
                            {isSelected && (
                              <CheckCircle2 size={15} className="absolute right-3 top-3 text-emerald-600 dark:text-emerald-400" />
                            )}
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
                              <Icon size={20} />
                            </div>
                            <div>
                              <p className={`text-sm font-bold ${isSelected ? "text-emerald-800 dark:text-emerald-300" : "text-gray-800 dark:text-gray-100"}`}>
                                {role === "FARMER" ? t.farmer : t.vendor}
                              </p>
                              <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                                {role === "FARMER" ? t.farmerDesc : t.vendorDesc}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {errors.role && <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{errors.role.message}</p>}
                  </div>

                  {/* Full Name */}
                  <div>
                    <label htmlFor="fullName" className={labelCls}>{t.fullName}</label>
                    <div className={fieldWrapCls(!!errors.fullName)}>
                      <input id="fullName" type="text" autoComplete="name" placeholder={t.fullNamePh}
                        {...register("fullName")} className={inputCls} />
                    </div>
                    {errors.fullName && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.fullName.message}</p>}
                  </div>

                  {/* Phone */}
                  <div>
                    <label htmlFor="phoneNumber" className={labelCls}>{t.phone}</label>
                    <div className={fieldWrapCls(!!errors.phoneNumber)}>
                      <span className="shrink-0 border-r border-gray-200 dark:border-gray-600 py-3 pl-4 pr-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
                        🇮🇳 +91
                      </span>
                      <input id="phoneNumber" type="tel" autoComplete="tel" placeholder={t.phonePh} maxLength={10}
                        {...register("phoneNumber", {
                          onChange: (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10); },
                        })}
                        className={`${inputCls} px-3`}
                      />
                    </div>
                    {errors.phoneNumber && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.phoneNumber.message}</p>}
                  </div>

                  {/* Email + Referral */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="email" className={labelCls}>{t.email}</label>
                      <div className={fieldWrapCls(!!errors.email)}>
                        <input id="email" type="email" autoComplete="email" placeholder={t.emailPh}
                          {...register("email")} className={inputCls} />
                      </div>
                      {errors.email && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.email.message}</p>}
                    </div>
                    <div>
                      <label htmlFor="referralCode" className={labelCls}>{t.referral}</label>
                      <div className={fieldWrapCls(false)}>
                        <input id="referralCode" type="text" placeholder={t.referralPh}
                          {...register("referralCode")} className={`${inputCls} uppercase`} />
                      </div>
                    </div>
                  </div>

                  <button type="button" onClick={goToStep2}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-bold text-white shadow hover:bg-emerald-800 active:scale-[0.98] transition-all">
                    {t.next} <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {/* ── Step 2 ── */}
              {step === 2 && (
                <div className="space-y-5">
                  {/* Password */}
                  <div>
                    <label htmlFor="password" className={labelCls}>{t.password}</label>
                    <div className={`${fieldWrapCls(!!errors.password)} relative`}>
                      <input id="password" type={showPw ? "text" : "password"}
                        autoComplete="new-password" placeholder={t.passwordPh}
                        {...register("password")} className={`${inputCls} pr-11`} />
                      <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1}
                        className="absolute right-3 text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                        {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.password.message}</p>}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="confirmPassword" className={labelCls}>{t.confirm}</label>
                    <div className={`${fieldWrapCls(!!errors.confirmPassword)} relative`}>
                      <input id="confirmPassword" type={showCpw ? "text" : "password"}
                        autoComplete="new-password" placeholder={t.confirmPh}
                        {...register("confirmPassword")} className={`${inputCls} pr-11`} />
                      <button type="button" onClick={() => setShowCpw(!showCpw)} tabIndex={-1}
                        className="absolute right-3 text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                        {showCpw ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.confirmPassword.message}</p>}
                  </div>

                  {/* Step 1 summary */}
                  <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-3.5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Registering as</p>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        selectedRole === "FARMER" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                      }`}>
                        {selectedRole === "FARMER" ? <Wheat size={18} /> : <Store size={18} />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{watch("fullName") || "—"}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {selectedRole === "FARMER" ? t.farmer : t.vendor} · +91 {watch("phoneNumber") || "—"}
                        </p>
                      </div>
                      <button type="button" onClick={() => setStep(1)}
                        className="ml-auto text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
                        Edit
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setStep(1)}
                      className="flex h-12 items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-600 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <ArrowLeft size={15} /> {t.back}
                    </button>
                    <button type="submit" disabled={isSubmitting}
                      className="flex flex-1 h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-bold text-white shadow hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all">
                      {isSubmitting
                        ? <><Loader2 size={16} className="animate-spin" />{t.submitting}</>
                        : <><UserPlus size={16} />{t.submit}</>}
                    </button>
                  </div>
                </div>
              )}
            </form>

            <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {t.haveAccount}{" "}
              <Link href="/auth/login" className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline underline-offset-2">
                {t.login}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
