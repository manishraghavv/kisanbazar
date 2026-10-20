"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useProductCatalogStore } from "@/stores/productCatalogStore";
import { useCartStore } from "@/stores/cartStore";
import { useWishlistStore } from "@/stores/wishlistStore";
import { useSearchContext } from "@/lib/search-context";

/** Debounce a value — returns the latest value only after `delay` ms of inactivity */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
import {
  SlidersHorizontal,
  X,
  Loader2,
  Star,
  ChevronLeft,
  ChevronRight,
  Eye,
  ArrowUpDown,
  Store,
  Package,
  ShoppingCart,
  Check,
  Heart,
} from "lucide-react";
import Link from "next/link";
import type { ProductListItem } from "@/types/auth";
import { cn } from "@/lib/cn";

// ─── Sort options ────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: "createdAt_desc", label: "Newest First" },
  { value: "createdAt_asc", label: "Oldest First" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "name_desc", label: "Name Z-A" },
];

// ─── Price ranges ────────────────────────────────────────────────────────────

const PRICE_RANGES = [
  { label: "Under ₹500", min: 0, max: 500 },
  { label: "₹500 - ₹1,000", min: 500, max: 1000 },
  { label: "₹1,000 - ₹5,000", min: 1000, max: 5000 },
  { label: "Above ₹5,000", min: 5000, max: undefined },
];

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

function getCropColor(crop: string) {
  const colors: Record<string, string> = {
    Wheat: "bg-amber-100 dark:bg-amber-900/50 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 dark:text-amber-300",
    Rice: "bg-green-100 dark:bg-green-900/50 dark:bg-green-900/50 text-green-800",
    Cotton: "bg-blue-100 dark:bg-blue-900/50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 dark:text-blue-300",
    Sugarcane: "bg-purple-100 dark:bg-purple-900/50 dark:bg-purple-900/50 text-purple-800",
    Maize: "bg-yellow-100 dark:bg-yellow-900/50 dark:bg-yellow-900/50 text-yellow-800",
    Paddy: "bg-lime-100 dark:bg-lime-900/50 dark:bg-lime-900/50 text-lime-800",
    Mustard: "bg-orange-100 dark:bg-orange-900/50 dark:bg-orange-900/50 text-orange-800",
    Groundnut: "bg-brown-100 text-brown-800",
    Soybean: "bg-teal-100 dark:bg-teal-900/50 dark:bg-teal-900/50 text-teal-800",
    Pulses: "bg-red-100 dark:bg-red-900/50 dark:bg-red-900/50 text-red-800",
  };
  return colors[crop] ?? "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-700 dark:text-gray-200 dark:text-gray-200";
}

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
      {/* Image */}
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
        {product.applicableCrops.length > 0 && (
          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
            {product.applicableCrops.slice(0, 2).map((crop) => (
              <span
                key={crop}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-medium shadow-sm dark:shadow-gray-950/30",
                  getCropColor(crop),
                )}
              >
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
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 line-clamp-2">
            {product.name}
          </h3>
          {product._count.reviews > 0 && (
            <div className="flex shrink-0 items-center gap-0.5 rounded bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30 px-1.5 py-0.5">
              <Star size={10} className="fill-amber-400 text-amber-400" />
              <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 dark:text-amber-400">
                {product._count.reviews}
              </span>
            </div>
          )}
        </div>

        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 line-clamp-1">
          {product.vendor.businessName}
        </p>

        {product.unitOfMeasure && (
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            Sold per {product.unitOfMeasure}
          </p>
        )}

        {/* Price */}
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
        </div>

        {/* Actions */}
        <button
          onClick={onViewDetail}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:border-emerald-300 dark:hover:border-emerald-600 dark:border-emerald-700 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400 dark:text-emerald-400 dark:hover:text-emerald-400"
        >
          <Eye size={13} />
          View Details
        </button>
      </div>
    </div>
  );
}

// ─── Product Detail Drawer ───────────────────────────────────────────────────

function ProductDetailDrawer({
  productId,
  onClose,
}: {
  productId: string;
  onClose: () => void;
}) {
  const { selectedProduct, isProductLoading, fetchProductById } =
    useProductCatalogStore();
  const { addItem, isAdding } = useCartStore();
  const { items: wishlistItems, getWishlist, addItem: addWishlist, removeItem: removeWishlist, isAdding: wishlistAdding } =
    useWishlistStore();
  const [loading, setLoading] = useState(false);
  const [addedVariantId, setAddedVariantId] = useState<string | null>(null);
  const [wishlistToggling, setWishlistToggling] = useState(false);

  useEffect(() => {
     
    Promise.all([
      fetchProductById(productId),
      getWishlist(),
    ]).finally(() => setLoading(false));
     
  }, [productId, fetchProductById, getWishlist]);

  if (loading || isProductLoading || !selectedProduct) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-end">
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="relative flex h-full w-full max-w-lg flex-col bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/50">
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400 dark:text-emerald-400" />
          </div>
        </div>
      </div>
    );
  }

  const product = selectedProduct;
  const mainImage = product.images.find((i) => i.isPrimary) ?? product.images[0];

  // Check if product is already in wishlist
  const isInWishlist = wishlistItems.some((item) => item.id === productId);
  const wishlistItem = wishlistItems.find((item) => item.id === productId);

  const handleWishlistToggle = async () => {
    setWishlistToggling(true);
    try {
      if (isInWishlist && wishlistItem) {
        await removeWishlist(wishlistItem.wishlistItemId);
      } else {
        await addWishlist(productId);
      }
      await getWishlist();
    } catch {
      // ignore
    } finally {
      setWishlistToggling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative flex h-full w-full max-w-2xl flex-col bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 dark:border-gray-700 px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
              {product.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{product.vendor.businessName}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleWishlistToggle}
              disabled={wishlistToggling || wishlistAdding}
              className={`rounded-lg p-1.5 transition-all ${
                isInWishlist
                  ? "text-red-500 dark:text-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 dark:hover:bg-red-900/30"
                  : "text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300 dark:hover:text-gray-300"
              } disabled:cursor-not-allowed disabled:opacity-50`}
              title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
            >
              {wishlistToggling ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Heart
                  size={18}
                  className={isInWishlist ? "fill-red-500" : ""}
                />
              )}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300 dark:hover:text-gray-300"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {/* Image Gallery */}
          {product.images.length > 0 && (
            <div className="overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
              <div className="aspect-[16/9]">
                <img
                  src={mainImage?.imageUrl}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              </div>
              {product.images.length > 1 && (
                <div className="flex gap-2 border-t border-gray-100 dark:border-gray-700 dark:border-gray-700 p-3">
                  {product.images.map((img) => (
                    <button
                      key={img.id}
                      className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                        img.isPrimary
                          ? "border-emerald-600 ring-1 ring-emerald-300"
                          : "border-gray-200 dark:border-gray-700 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 dark:border-gray-600 dark:hover:border-gray-500"
                      }`}
                    >
                      <img
                        src={img.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick meta */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Category
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {product.category.name}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Unit
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {product.unitOfMeasure ?? "—"}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                HSN Code
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {product.hsnCode ?? "—"}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                GST
              </p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {product.gstRate ? `${product.gstRate}%` : "—"}
              </p>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                Description
              </h3>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300 dark:text-gray-300">
                {product.description}
              </p>
            </div>
          )}

          {/* Attributes */}
          {product.attributes.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                Specifications
              </h3>
              <div className="divide-y divide-gray-100 dark:divide-gray-700 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700">
                {product.attributes.map((attr) => (
                  <div
                    key={attr.id}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <span className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">{attr.name}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                      {attr.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Variants / Pricing */}
          {product.variants.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                Variants & Pricing
              </h3>
              <div className="divide-y divide-gray-100 dark:divide-gray-700 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700">
                {product.variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                        {variant.variantName ?? "Default"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                        SKU: {variant.sku}
                        {variant.weightGrams &&
                          ` · ${variant.weightGrams}g`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                        {formatCurrency(variant.sellingPrice)}
                      </p>
                      {variant.mrp > variant.sellingPrice && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 line-through">
                          {formatCurrency(variant.mrp)}
                        </p>
                      )}
                      <p
                        className={`text-[11px] ${
                          variant.stockQuantity > 0
                            ? "text-emerald-600 dark:text-emerald-400 dark:text-emerald-400"
                            : "text-red-500 dark:text-red-400 dark:text-red-400"
                        }`}
                      >
                        {variant.stockQuantity > 0
                          ? `${variant.stockQuantity} in stock`
                          : "Out of stock"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Applicable Crops */}
          {product.applicableCrops.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                Applicable Crops
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {product.applicableCrops.map((crop) => (
                  <span
                    key={crop}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      getCropColor(crop),
                    )}
                  >
                    {crop}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Add to Cart */}
          <div className="flex gap-3">
            {product.variants.slice(0, 3).map((variant) => {
              const justAdded = addedVariantId === variant.id;
              return (
                <button
                  key={variant.id}
                  onClick={async () => {
                    try {
                      await addItem(variant.id, 1);
                      setAddedVariantId(variant.id);
                      setTimeout(() => setAddedVariantId(null), 2000);
                    } catch {
                      // ignore — toast in store
                    }
                  }}
                  disabled={isAdding || variant.stockQuantity <= 0}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold shadow transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    justAdded
                      ? "bg-emerald-100 dark:bg-emerald-900/50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 dark:text-emerald-300"
                      : "bg-emerald-700 text-white hover:bg-emerald-800"
                  }`}
                >
                  {justAdded ? (
                    <Check size={16} />
                  ) : (
                    <ShoppingCart size={16} />
                  )}
                  {justAdded
                    ? "Added!"
                    : variant.stockQuantity <= 0
                      ? "Out of Stock"
                      : `Add to Cart${product.variants.length > 1 ? ` — ${variant.variantName ?? variant.sku}` : ""}`}
                </button>
              );
            })}
            {product.variants.length > 3 && (
              <Link
                href="/dashboard/cart"
                className="flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50"
              >
                View All Variants
              </Link>
            )}
          </div>

          {/* Vendor Info */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30">
                <Store size={18} className="text-blue-700 dark:text-blue-400 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                  {product.vendor.businessName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Sold by {product.vendor.user.fullName}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30">
        <Package size={36} className="text-emerald-300" />
      </div>
      <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
        {hasFilters ? "No products match your filters" : "No products available"}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
        {hasFilters
          ? "Try adjusting your search or filter criteria"
          : "Check back later for new products"}
      </p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="mt-6 flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50"
        >
          <X size={16} />
          Clear All Filters
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const {
    products,
    total,
    totalPages,
    page,
    isLoading,
    categories,
    fetchProducts,
    fetchCategories,
  } = useProductCatalogStore();

  // Shared search query from Navbar
  const { searchQuery, setSearchQuery } = useSearchContext();

  // Seed context from URL search params on first mount (e.g. ?search=fertilizer)
  const hasSeeded = useRef(false);
  useEffect(() => {
    if (hasSeeded.current) return;
    hasSeeded.current = true;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("search");
    if (q) setSearchQuery(q);
  }, [setSearchQuery]);

  // Debounced search — avoids API calls on every keystroke
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Filters
  const search = debouncedSearch;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<{
    min?: number;
    max?: number;
  } | null>(null);
  const [sortBy, setSortBy] = useState("createdAt_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minRating, setMinRating] = useState<number | null>(null);

  // Load categories on mount
  useEffect(() => {
    fetchCategories().catch(() => {});
     
  }, [fetchCategories]);

  // Build filter params
  const filterParams = useMemo(() => {
    const [sortField, sortOrder] = sortBy.split("_");
    return {
      page: currentPage,
      limit: 20,
      search: search || undefined,
      categoryId: selectedCategory ?? undefined,
      minPrice: priceRange?.min,
      maxPrice: priceRange?.max,
      crop: selectedCrop ?? undefined,
      sortBy: sortField,
      sortOrder,
      inStockOnly: inStockOnly || undefined,
      minRating: minRating ?? undefined,
    };
  }, [currentPage, search, selectedCategory, selectedCrop, priceRange, sortBy, inStockOnly, minRating]);

  // Load products
  const loadProducts = useCallback(() => {
    fetchProducts(filterParams).catch(() => {});
  }, [fetchProducts, filterParams]);

  useEffect(() => {
     
    loadProducts();
     
  }, [loadProducts]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory(null);
    setSelectedCrop(null);
    setPriceRange(null);
    setSortBy("createdAt_desc");
    setInStockOnly(false);
    setMinRating(null);
    setCurrentPage(1);
  };

  const hasActiveFilters = !!(search || selectedCategory || selectedCrop || priceRange || inStockOnly || minRating);

  // Collect unique crops from current products for filter
  const availableCrops = useMemo(() => {
    const cropSet = new Set<string>();
    products.forEach((p) => p.applicableCrops.forEach((c) => cropSet.add(c)));
    return Array.from(cropSet).sort();
  }, [products]);

  const handlePageChange = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
      {/* Top header bar */}
      <div className="border-b border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                Product Catalog
              </h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Browse agricultural inputs and supplies
              </p>
            </div>
          </div>

          {/* Sort & Filter Bar (search is handled by the navbar) */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
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
                  showFilters || hasActiveFilters
                    ? "border-emerald-300 dark:border-emerald-700 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 dark:text-emerald-400"
                    : "border-gray-300 dark:border-gray-600 dark:border-gray-600 text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50"
                }`}
              >
                <SlidersHorizontal size={15} />
                Filters
                {hasActiveFilters && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 text-[10px] font-bold text-white">
                    {
                      [search, selectedCategory, selectedCrop, priceRange].filter(
                        Boolean,
                      ).length
                    }
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-4">
              <div className="grid gap-4 sm:grid-cols-3">
                {/* Category */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedCategory(null);
                        setCurrentPage(1);
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        !selectedCategory
                          ? "bg-emerald-700 text-white"
                          : "bg-white dark:bg-gray-800 dark:bg-gray-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 dark:border-gray-700"
                      }`}
                    >
                      All
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(
                            selectedCategory === cat.id ? null : cat.id,
                          );
                          setCurrentPage(1);
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                          selectedCategory === cat.id
                            ? "bg-emerald-700 text-white"
                            : "bg-white dark:bg-gray-800 dark:bg-gray-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 dark:border-gray-700"
                        }`}
                      >
                        {cat.name}
                        {cat._count && (
                          <span className="ml-1 opacity-60">
                            ({cat._count.products})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Crops */}
                {availableCrops.length > 0 && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      Crop
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedCrop(null);
                          setCurrentPage(1);
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                          !selectedCrop
                            ? "bg-emerald-700 text-white"
                            : "bg-white dark:bg-gray-800 dark:bg-gray-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 dark:border-gray-700"
                        }`}
                      >
                        Any
                      </button>
                      {availableCrops.map((crop) => (
                        <button
                          key={crop}
                          onClick={() => {
                            setSelectedCrop(
                              selectedCrop === crop ? null : crop,
                            );
                            setCurrentPage(1);
                          }}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                            selectedCrop === crop
                              ? "bg-emerald-700 text-white"
                              : "bg-white dark:bg-gray-800 dark:bg-gray-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 dark:border-gray-700"
                          }`}
                        >
                          {crop}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price Range */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
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
                              active
                                ? null
                                : { min: range.min, max: range.max },
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
                </div>
              </div>

              {/* In Stock Only + Min Rating */}
              <div className="mt-4 flex flex-wrap gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Availability</label>
                  <button
                    onClick={() => { setInStockOnly(!inStockOnly); setCurrentPage(1); }}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      inStockOnly
                        ? "bg-emerald-700 text-white border-emerald-700"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${inStockOnly ? "bg-white" : "bg-emerald-500"}`} />
                    In Stock Only
                  </button>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Min Rating</label>
                  <div className="flex gap-1.5">
                    {([null, 3, 4, 5] as const).map((r) => (
                      <button
                        key={r ?? "all"}
                        onClick={() => { setMinRating(r); setCurrentPage(1); }}
                        className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                          minRating === r
                            ? "bg-emerald-700 text-white border-emerald-700"
                            : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        {r ? <><Star size={10} className={minRating === r ? "fill-white text-white" : "fill-amber-400 text-amber-400"} /> {r}+</> : "Any"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Clear all */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700"
                >
                  <X size={12} />
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-emerald-700 dark:text-emerald-400 dark:text-emerald-400" />
          </div>
        )}

        {/* Products Grid */}
        {!isLoading && (
          <>
            {products.length === 0 ? (
              <EmptyState
                hasFilters={hasActiveFilters}
                onClear={clearFilters}
              />
            ) : (
              <div className="space-y-6">
                {/* Result count */}
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Showing {products.length} of {total} product{total !== 1 ? "s" : ""}
                </p>

                {/* Grid */}
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onViewDetail={() => setDetailProductId(product.id)}
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
          </>
        )}
      </div>

      {/* Detail Drawer */}
      {detailProductId && (
        <ProductDetailDrawer
          productId={detailProductId}
          onClose={() => setDetailProductId(null)}
        />
      )}
    </div>
  );
}
