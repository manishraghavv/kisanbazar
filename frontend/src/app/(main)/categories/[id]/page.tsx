"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useProductCatalogStore } from "@/stores/productCatalogStore";
import apiClient from "@/lib/api-client";
import {
  Search,
  SlidersHorizontal,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Package,
  Eye,
  FolderTree,
} from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import Link from "next/link";
import type { ProductListItem, Category } from "@/types/auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function getLowestPrice(variants: { sellingPrice: number }[]) {
  if (variants.length === 0) return 0;
  return Math.min(...variants.map((v) => v.sellingPrice));
}

function getHighestPrice(variants: { sellingPrice: number }[]) {
  if (variants.length === 0) return 0;
  return Math.max(...variants.map((v) => v.sellingPrice));
}

const SORT_OPTIONS = [
  { value: "createdAt_desc", label: "Newest First" },
  { value: "createdAt_asc", label: "Oldest First" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "name_desc", label: "Name Z-A" },
];

const PRICE_RANGES = [
  { label: "Under ₹500", min: 0, max: 500 },
  { label: "₹500 - ₹1,000", min: 500, max: 1000 },
  { label: "₹1,000 - ₹5,000", min: 1000, max: 5000 },
  { label: "Above ₹5,000", min: 5000, max: undefined },
];

// ─── Product Card ────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onViewDetail,
}: {
  product: ProductListItem;
  onViewDetail: () => void;
}) {
  const lowestPrice = getLowestPrice(product.variants);
  const highestPrice = getHighestPrice(product.variants);
  const imageUrl = product.images[0]?.imageUrl;

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-lg dark:shadow-gray-950/30 hover:border-emerald-200 dark:hover:border-emerald-700 dark:border-emerald-800 dark:hover:border-emerald-700">
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package size={48} className="text-gray-200" />
          </div>
        )}
        {product.seasonalFlag && (
          <span className="absolute left-2 top-2 rounded-full bg-emerald-600/90 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            Seasonal
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 line-clamp-2">
          {product.name}
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 line-clamp-1">
          {product.vendor.businessName}
        </p>
        {product.unitOfMeasure && (
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            Per {product.unitOfMeasure}
          </p>
        )}

        <div className="mt-auto pt-3">
          {lowestPrice > 0 && (
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {formatCurrency(lowestPrice)}
              </span>
              {highestPrice > lowestPrice && (
                <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 line-through">
                  {formatCurrency(highestPrice)}
                </span>
              )}
            </div>
          )}
        </div>          <Link
            href={`/products/${product.id}`}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:border-emerald-300 dark:hover:border-emerald-600 dark:border-emerald-700 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400 dark:text-emerald-400 dark:hover:text-emerald-400"
          >
            <Eye size={13} />
            View Details
          </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CategoryProductsPage() {
  const params = useParams();
  const categoryId = params.id as string;

  const { products, total, totalPages, page, isLoading, fetchProducts } =
    useProductCatalogStore();

  const [category, setCategory] = useState<Category | null>(null);
  const [catLoading, setCatLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("createdAt_desc");
  const [priceRange, setPriceRange] = useState<{
    min?: number;
    max?: number;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch category info
  useEffect(() => {
    setCatLoading(true);
    apiClient
      .get<{ success: boolean; data: Category }>(`/categories/${categoryId}`)
      .then((res) => setCategory(res.data.data))
      .catch(() => toast.error("Failed to load category"))
      .finally(() => setCatLoading(false));
  }, [categoryId]);

  // Fetch products with filters
  useEffect(() => {
    const [sortField, sortOrder] = sortBy.split("_");
    fetchProducts({
      page: currentPage,
      limit: 20,
      search: search || undefined,
      categoryId,
      minPrice: priceRange?.min,
      maxPrice: priceRange?.max,
      sortBy: sortField,
      sortOrder,
    }).catch(() => toast.error("Failed to load products"));
  }, [currentPage, search, categoryId, priceRange, sortBy, fetchProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setSearchInput("");
    setPriceRange(null);
    setSortBy("createdAt_desc");
    setCurrentPage(1);
  };

  const hasFilters = !!(search || priceRange);

  const handlePageChange = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="mb-3">
            <Breadcrumbs
              items={
                catLoading
                  ? [
                      { label: "Home", href: "/" },
                      { label: "Categories", href: "/categories" },
                      { label: "Loading..." },
                    ]
                  : [
                      { label: "Home", href: "/" },
                      { label: "Categories", href: "/categories" },
                      { label: category?.name ?? "Category" },
                    ]
              }
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50 dark:bg-emerald-900/50">
              {category?.iconUrl ? (
                <img
                  src={category.iconUrl}
                  alt=""
                  className="h-7 w-7 rounded object-contain"
                />
              ) : (
                <FolderTree size={22} className="text-emerald-700 dark:text-emerald-400 dark:text-emerald-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {catLoading ? "Loading..." : category?.name ?? "Category"}
              </h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                {category?._count?.products
                  ? `${category._count.products} products`
                  : "Browse products in this category"}
              </p>
            </div>
          </div>

          {/* Search & Sort Bar */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <form onSubmit={handleSearch} className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search in this category..."
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
              />
            </form>
            <div className="flex gap-2">
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="appearance-none rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 bg-white dark:bg-gray-800 dark:bg-gray-800 px-9 py-2.5 pr-3 text-sm text-gray-700 dark:text-gray-200 dark:text-gray-200 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ArrowUpDown
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all ${
                  showFilters || hasFilters
                    ? "border-emerald-300 dark:border-emerald-700 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 dark:text-emerald-400"
                    : "border-gray-300 dark:border-gray-600 dark:border-gray-600 text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50"
                }`}
              >
                <SlidersHorizontal size={15} />
                Price
                {hasFilters && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 text-[10px] font-bold text-white">
                    {[search, priceRange].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Price Filter Panel */}
          {showFilters && (
            <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Price Range
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => {
                    setPriceRange(null);
                    setCurrentPage(1);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    !priceRange
                      ? "bg-emerald-700 text-white"
                      : "bg-white dark:bg-gray-800 dark:bg-gray-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 dark:border-gray-700"
                  }`}
                >
                  Any
                </button>
                {PRICE_RANGES.map((range) => {
                  const active =
                    priceRange?.min === range.min &&
                    priceRange?.max === range.max;
                  return (
                    <button
                      key={range.label}
                      onClick={() => {
                        setPriceRange(
                          active ? null : { min: range.min, max: range.max },
                        );
                        setCurrentPage(1);
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        active
                          ? "bg-emerald-700 text-white"
                          : "bg-white dark:bg-gray-800 dark:bg-gray-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 dark:border-gray-700"
                      }`}
                    >
                      {range.label}
                    </button>
                  );
                })}
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 dark:text-red-400 hover:text-red-700 dark:text-red-400"
                >
                  <X size={12} />
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Products */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-emerald-700 dark:text-emerald-400 dark:text-emerald-400" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30">
              <Package size={36} className="text-emerald-300" />
            </div>
            <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
              {hasFilters
                ? "No products match your filters"
                : "No products in this category yet"}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              {hasFilters
                ? "Try adjusting your filters"
                : "Check back later for new products"}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-6 flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50"
              >
                <X size={16} />
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Showing {products.length} of {total} product
              {total !== 1 ? "s" : ""}
            </p>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onViewDetail={() => {}}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 px-4 py-3 shadow-sm dark:shadow-gray-950/30">
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from(
                    { length: Math.min(totalPages, 5) },
                    (_, i) => {
                      const start = Math.max(1, currentPage - 2);
                      const p = start + i;
                      if (p > totalPages) return null;
                      return (
                        <button
                          key={p}
                          onClick={() => handlePageChange(p)}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                            p === currentPage
                              ? "bg-emerald-700 text-white"
                              : "text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    },
                  )}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
