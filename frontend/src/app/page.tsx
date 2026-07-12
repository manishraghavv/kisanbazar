"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProductCatalogStore } from "@/stores/productCatalogStore";
import { useCartStore } from "@/stores/cartStore";
import { useAuthStore } from "@/stores/authStore";
import {
  Sprout, ShoppingBag, BookOpen, TrendingUp, Package,
  ShoppingCart, Check, ChevronRight, Loader2, Store,
  ArrowRight, Wheat, Users, MapPin,
} from "lucide-react";
import type { ProductListItem, Category } from "@/types/auth";
import { cn } from "@/lib/cn";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}
function getLowestPrice(variants: { sellingPrice: number }[]) {
  if (!variants.length) return 0;
  return Math.min(...variants.map((v) => v.sellingPrice));
}
function getHighestPrice(variants: { sellingPrice: number }[]) {
  if (!variants.length) return 0;
  return Math.max(...variants.map((v) => v.sellingPrice));
}
function getCropColor(crop: string) {
  const m: Record<string, string> = {
    Wheat:     "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300",
    Rice:      "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300",
    Cotton:    "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300",
    Sugarcane: "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300",
    Maize:     "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300",
    Paddy:     "bg-lime-100 dark:bg-lime-900/40 text-lime-800 dark:text-lime-300",
    Mustard:   "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300",
    Groundnut: "bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300",
    Soybean:   "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300",
    Pulses:    "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300",
  };
  return m[crop] ?? "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200";
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function FeaturedProductCard({ product }: { product: ProductListItem }) {
  const router = useRouter();
  const { addItem, isAdding } = useCartStore();
  const { user } = useAuthStore();
  const lowestPrice = getLowestPrice(product.variants);
  const highestPrice = getHighestPrice(product.variants);
  const imageUrl = product.images[0]?.imageUrl;
  const [added, setAdded] = useState(false);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { router.push("/auth/login"); return; }
    const variant = product.variants[0];
    if (!variant || variant.stockQuantity <= 0) return;
    try {
      await addItem(variant.id, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div
      onClick={() => router.push(`/products/${product.id}`)}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-all hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-50 dark:bg-gray-700/50">
        {imageUrl ? (
          <img src={imageUrl} alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package size={40} className="text-gray-200 dark:text-gray-600" />
          </div>
        )}
        {product.seasonalFlag && (
          <span className="absolute left-2 top-2 rounded-full bg-emerald-700/90 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            Seasonal
          </span>
        )}
        {product.applicableCrops.length > 0 && (
          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
            {product.applicableCrops.slice(0, 2).map((crop) => (
              <span key={crop} className={cn("rounded-full px-2 py-0.5 text-[9px] font-medium", getCropColor(crop))}>
                {crop}
              </span>
            ))}
            {product.applicableCrops.length > 2 && (
              <span className="rounded-full bg-gray-900/60 px-2 py-0.5 text-[9px] font-medium text-white">
                +{product.applicableCrops.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-gray-100 transition-colors group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
          {product.name}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">{product.vendor.businessName}</p>

        <div className="mt-auto pt-3">
          {lowestPrice > 0 && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(lowestPrice)}</span>
              {highestPrice > lowestPrice && (
                <span className="text-xs text-gray-400 dark:text-gray-500 line-through">{formatCurrency(highestPrice)}</span>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={(e) => { e.stopPropagation(); router.push(`/products/${product.id}`); }}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
            View
          </button>
          {product.variants.length > 0 && product.variants[0].stockQuantity > 0 ? (
            <button onClick={handleAddToCart} disabled={isAdding}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all disabled:opacity-50 ${
                added
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                  : "bg-emerald-700 text-white hover:bg-emerald-800"
              }`}>
              {added ? <><Check size={13} /> Added</> : <><ShoppingCart size={13} /> Cart</>}
            </button>
          ) : (
            <button disabled
              className="flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 cursor-not-allowed">
              Out of Stock
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({ category }: { category: Category }) {
  return (
    <Link href={`/categories/${category.id}`}
      className="group flex flex-col items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm transition-all hover:border-emerald-200 dark:hover:border-emerald-700 hover:shadow-md">
      {category.iconUrl ? (
        <img src={category.iconUrl} alt={category.name} className="mb-3 h-14 w-14 rounded-xl object-contain" />
      ) : (
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30 transition-colors group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50">
          <Package size={24} className="text-emerald-700 dark:text-emerald-400" />
        </div>
      )}
      <h3 className="text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{category.name}</h3>
      {category.nameHi && (
        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{category.nameHi}</p>
      )}
      {category._count && (
        <span className="mt-2 rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
          {category._count.products ?? category._count.children ?? 0} items
        </span>
      )}
    </Link>
  );
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "10,000+", label: "Farmers",  icon: Users  },
  { value: "500+",    label: "Vendors",  icon: Store  },
  { value: "2,000+", label: "Products", icon: Package },
  { value: "12",      label: "States",   icon: MapPin },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { products, isLoading, categories, categoriesLoading, fetchProducts, fetchCategories } =
    useProductCatalogStore();
  const { user } = useAuthStore();
  const [topCategories, setTopCategories] = useState<Category[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (dataLoaded) return;
    setDataLoaded(true);
    fetchProducts({ limit: 8, sortBy: "createdAt", sortOrder: "desc" }).catch(() => {});
    fetchCategories()
      .then(() => {
        const top = useProductCatalogStore.getState().categories.filter((c) => !c.parentId);
        setTopCategories(top);
      })
      .catch(() => {});
  }, [dataLoaded, fetchProducts, fetchCategories]);

  const featuredProducts = products.slice(0, 8);

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-900">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4 shadow-sm">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 shadow">
            <Sprout size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold text-emerald-800 dark:text-emerald-400">Kisaan Bazaar</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/products" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            Browse Products
          </Link>
          {user ? (
            <Link href="/dashboard" className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-emerald-800">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/auth/login" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                Sign In
              </Link>
              <Link href="/auth/register" className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-emerald-800">
                Get Started
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="flex flex-1 flex-col">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-600 px-6 py-24 text-center">
          {/* Dot grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
          />
          {/* Radial glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(255,255,255,0.08)_0%,transparent_70%)]" />
          {/* Wheat watermark */}
          <div className="pointer-events-none absolute -bottom-12 -right-12 opacity-[0.06]">
            <Wheat size={280} className="text-white" strokeWidth={0.8} />
          </div>

          <div className="relative z-10 mx-auto max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-emerald-100 ring-1 ring-white/15">
              <Sprout size={14} /> India&apos;s Agri-Commerce Platform
            </div>
            <h1 className="mb-4 text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
              Connecting Farmers &amp;<br className="hidden md:block" /> Vendors
            </h1>
            <p className="mb-8 text-lg leading-relaxed text-emerald-100/80">
              Buy agri-inputs, manage Khata credit, and grow your business — all in one place.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/auth/register"
                className="flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-emerald-800 shadow-lg transition-all hover:bg-emerald-50 hover:scale-[1.02] active:scale-[0.98]">
                <Users size={16} /> Join as Farmer
              </Link>
              <Link href="/auth/register"
                className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3 text-sm font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98]">
                <Store size={16} /> Join as Vendor
              </Link>
              <Link href="/products"
                className="flex items-center gap-2 rounded-full border border-white/20 px-7 py-3 text-sm font-semibold text-emerald-100 transition-all hover:bg-white/10">
                Browse Products <ArrowRight size={15} />
              </Link>
            </div>

            {/* Hero stats */}
            <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STATS.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 mx-auto">
                      <Icon size={15} className="text-emerald-200" />
                    </div>
                    <p className="text-2xl font-extrabold text-white">{s.value}</p>
                    <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-emerald-300/80">{s.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Featured Products ── */}
        <section className="px-6 py-16 md:px-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Featured Products</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Latest agricultural inputs and supplies</p>
              </div>
              <Link href="/products" className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors">
                View All <ChevronRight size={16} />
              </Link>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
              </div>
            ) : featuredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-12">
                <Package size={36} className="text-gray-300 dark:text-gray-600" />
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No products available yet</p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {featuredProducts.map((p) => <FeaturedProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </section>

        {/* ── Categories ── */}
        {topCategories.length > 0 && (
          <section className="bg-gray-50 dark:bg-gray-800/50 px-6 py-16 md:px-16">
            <div className="mx-auto max-w-7xl">
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Shop by Category</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Browse agricultural supplies by category</p>
                </div>
                <Link href="/categories" className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors">
                  All Categories <ChevronRight size={16} />
                </Link>
              </div>
              {categoriesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {topCategories.slice(0, 12).map((c) => <CategoryCard key={c.id} category={c} />)}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── How It Works ── */}
        <section className="px-6 py-16 md:px-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">How It Works</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Three simple steps to get started</p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {[
                { step: "01", title: "Create Your Account", desc: "Sign up as a farmer or vendor. Fast OTP verification with your phone number." },
                { step: "02", title: "Browse & Order",       desc: "Explore thousands of agri-inputs, compare prices, and place orders online." },
                { step: "03", title: "Pay with Khata Credit", desc: "Use the built-in credit system to buy now and pay later. Manage udhar digitally." },
              ].map((item) => (
                <div key={item.step} className="relative pl-14">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-600 px-6 py-16 md:px-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
          />
          <div className="relative z-10 mx-auto max-w-7xl">
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-bold text-white">Why Kisaan Bazaar?</h2>
              <p className="mt-1 text-sm text-emerald-200">Built for Indian agriculture</p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { icon: ShoppingBag, title: "Agri-Input Marketplace", desc: "Browse seeds, fertilizers, pesticides, and equipment from verified vendors across India." },
                { icon: BookOpen,    title: "KhataBook Credit System", desc: "Buy now, pay later with our integrated credit ledger. Manage udhar digitally." },
                { icon: TrendingUp,  title: "Vendor Analytics",        desc: "Track sales, commissions, and settlements with real-time dashboards." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-xl border border-white/10 bg-white/10 p-6 backdrop-blur-sm transition-all hover:bg-white/15">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
                    <Icon size={24} className="text-white" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
                  <p className="text-sm leading-relaxed text-emerald-100/80">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-white dark:bg-gray-900 px-6 py-16 text-center md:px-16">
          <div className="mx-auto max-w-lg">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ready to get started?</h2>
            <p className="mx-auto mt-2 text-sm text-gray-500 dark:text-gray-400">
              Join thousands of farmers and vendors already using Kisaan Bazaar.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <Link href="/auth/register"
                className="flex items-center gap-2 rounded-full bg-emerald-700 px-8 py-3 text-sm font-semibold text-white shadow transition-colors hover:bg-emerald-800">
                Create Free Account <ArrowRight size={16} />
              </Link>
              <Link href="/products"
                className="flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-600 px-8 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <Store size={16} /> Browse Products
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <div className="mx-auto max-w-7xl">
            <div className="mb-4 flex items-center justify-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-700">
                <Sprout size={14} className="text-white" />
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">Kisaan Bazaar</span>
            </div>
            <p>© 2025 Kisaan Bazaar. Rooted in Trust.</p>
            <div className="mt-3 flex items-center justify-center gap-4 text-xs">
              <Link href="/products"   className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Products</Link>
              <Link href="/categories" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Categories</Link>
              <Link href="/auth/login" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Sign In</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
