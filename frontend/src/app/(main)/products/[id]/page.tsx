"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useProductCatalogStore } from "@/stores/productCatalogStore";
import { useCartStore } from "@/stores/cartStore";
import { useWishlistStore } from "@/stores/wishlistStore";
import apiClient from "@/lib/api-client";
import ProductReviews from "@/components/reviews/ProductReviews";
import {
  Loader2,
  Package,
  ShoppingCart,
  Check,
  Heart,
  Store,
  ArrowLeft,
  Tag,
  Ruler,
  Hash,
  Percent,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { BackButton } from "@/components/ui/BackButton";
import type { ProductDetail } from "@/types/auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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
    Groundnut: "bg-teal-100 dark:bg-teal-900/50 dark:bg-teal-900/50 text-teal-800",
    Soybean: "bg-emerald-100 dark:bg-emerald-900/50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 dark:text-emerald-300",
    Pulses: "bg-red-100 dark:bg-red-900/50 dark:bg-red-900/50 text-red-800",
  };
  return colors[crop] ?? "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-700 dark:text-gray-200 dark:text-gray-200";
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 dark:bg-emerald-900/50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 dark:text-emerald-300",
  DRAFT: "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-600 dark:text-gray-300 dark:text-gray-300",
  PENDING_APPROVAL: "bg-amber-100 dark:bg-amber-900/50 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 dark:text-amber-300",
  REJECTED: "bg-red-100 dark:bg-red-900/50 dark:bg-red-900/50 text-red-800",
  INACTIVE: "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500",
  OUT_OF_STOCK: "bg-orange-100 dark:bg-orange-900/50 dark:bg-orange-900/50 text-orange-800",
  DISCONTINUED: "bg-red-100 dark:bg-red-900/50 dark:bg-red-900/50 text-red-600 dark:text-red-400 dark:text-red-400",
};

function getStatusColor(status: string) {
  return STATUS_COLORS[status] ?? "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-600 dark:text-gray-300 dark:text-gray-300";
}

// ─── Image Gallery Component ─────────────────────────────────────────────────

function ImageGallery({ images, name }: { images: ProductDetail["images"]; name: string }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const primaryIndex = images.findIndex((i) => i.isPrimary);
  const activeIndex = primaryIndex >= 0 ? primaryIndex : selectedIndex;
  const activeImage = images[activeIndex];

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
        <Package size={80} className="text-gray-200" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="overflow-hidden rounded-2xl bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
        <div className="aspect-square">
          <img
            src={activeImage?.imageUrl}
            alt={name}
            className="h-full w-full object-cover transition-all duration-300"
          />
        </div>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setSelectedIndex(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                i === activeIndex
                  ? "border-emerald-600 ring-2 ring-emerald-300"
                  : "border-gray-200 dark:border-gray-700 dark:border-gray-700 hover:border-gray-400"
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
  );
}

// ─── Variant Selector ────────────────────────────────────────────────────────

function VariantSelector({
  variants,
  selectedVariantId,
  onSelect,
  onAddToCart,
  isAdding,
  addedVariantId,
}: {
  variants: ProductDetail["variants"];
  selectedVariantId: string | null;
  onSelect: (id: string) => void;
  onAddToCart: (variantId: string) => Promise<void>;
  isAdding: boolean;
  addedVariantId: string | null;
}) {
  const selected = variants.find((v) => v.id === selectedVariantId) ?? variants[0];

  return (
    <div className="space-y-4">
      {/* Variant Pills */}
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const isSelected = v.id === selected?.id;
          return (
            <button
              key={v.id}
              onClick={() => onSelect(v.id)}
              disabled={v.stockQuantity <= 0}
              className={`rounded-xl border-2 px-4 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                isSelected
                  ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 shadow-sm dark:shadow-gray-950/30"
                  : "border-gray-200 dark:border-gray-700 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 dark:border-gray-600 dark:hover:border-gray-500"
              }`}
            >
              <p className={`text-sm font-semibold ${isSelected ? "text-emerald-900" : "text-gray-900 dark:text-gray-100 dark:text-gray-100"}`}>
                {v.variantName ?? "Standard"}
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`text-base font-bold ${isSelected ? "text-emerald-700 dark:text-emerald-400 dark:text-emerald-400" : "text-gray-900 dark:text-gray-100 dark:text-gray-100"}`}>
                  {formatCurrency(v.sellingPrice)}
                </span>
                {v.mrp > v.sellingPrice && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 line-through">
                    {formatCurrency(v.mrp)}
                  </span>
                )}
              </div>
              {v.weightGrams && (
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  {v.weightGrams}g per unit
                </p>
              )}
              <p className={`mt-1 text-[11px] font-medium ${
                v.stockQuantity > 5
                  ? "text-emerald-600 dark:text-emerald-400 dark:text-emerald-400"
                  : v.stockQuantity > 0
                    ? "text-amber-600 dark:text-amber-400 dark:text-amber-400"
                    : "text-red-500 dark:text-red-400 dark:text-red-400"
              }`}>
                {v.stockQuantity > 5
                  ? `In Stock (${v.stockQuantity})`
                  : v.stockQuantity > 0
                    ? `Low Stock (${v.stockQuantity})`
                    : "Out of Stock"}
              </p>
            </button>
          );
        })}
      </div>

      {/* Add to Cart */}
      <button
        onClick={() => onAddToCart(selected.id)}
        disabled={isAdding || selected.stockQuantity <= 0}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold shadow transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
          addedVariantId === selected.id
            ? "bg-emerald-100 dark:bg-emerald-900/50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 dark:text-emerald-300"
            : "bg-emerald-700 text-white hover:bg-emerald-800"
        }`}
      >
        {addedVariantId === selected.id ? (
          <>
            <Check size={18} />
            Added to Cart!
          </>
        ) : selected.stockQuantity <= 0 ? (
          <>
            <XCircle size={18} />
            Out of Stock
          </>
        ) : (
          <>
            <ShoppingCart size={18} />
            Add to Cart — {formatCurrency(selected.sellingPrice)}
          </>
        )}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;

  const { selectedProduct, isProductLoading, fetchProductById, clearSelectedProduct } =
    useProductCatalogStore();
  const { addItem, isAdding } = useCartStore();
  const { items: wishlistItems, getWishlist, addItem: addWishlist, removeItem: removeWishlist } =
    useWishlistStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  interface ReviewItem {
    id: string;
    helpfulCount: number;
    [key: string]: unknown;
  }
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [addedVariantId, setAddedVariantId] = useState<string | null>(null);
  const [wishlistToggling, setWishlistToggling] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotalPages, setReviewsTotalPages] = useState(0);
  const [showReviews, setShowReviews] = useState(false);
  const [helpingReview, setHelpingReview] = useState<string | null>(null);
  const [helpfulClicked, setHelpfulClicked] = useState<Record<string, boolean>>({});

  const loadReviews = useCallback(async (p: number) => {
    setReviewsLoading(true);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: { reviews: ReviewItem[]; averageRating: number; totalReviews: number; totalPages: number };
      }>(`/products/${productId}/reviews`, { params: { page: p, limit: 10 } });
      setReviews(res.data.data.reviews);
      setAverageRating(res.data.data.averageRating);
      setReviewsPage(p);
      setReviewsTotalPages(res.data.data.totalPages);
    } catch {
      // silently fail
    } finally {
      setReviewsLoading(false);
    }
  }, [productId]);

  const handleHelpful = async (reviewId: string) => {
    setHelpingReview(reviewId);
    try {
      const res = await apiClient.post<{ success: boolean; data: { helpfulCount: number } }>(`/reviews/${reviewId}/helpful`);
      setHelpfulClicked((prev) => ({ ...prev, [reviewId]: true }));
      // Update local count
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, helpfulCount: res.data.data.helpfulCount } : r)),
      );
    } catch {
      toast.error("Failed to mark as helpful");
    } finally {
      setHelpingReview(null);
    }
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setError(null);
    clearSelectedProduct();
    Promise.all([
      fetchProductById(productId),
      getWishlist(),
    ])
      .then(() => setLoading(false))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load product");
        setLoading(false);
      });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [productId, fetchProductById, getWishlist, clearSelectedProduct]);

  // Load reviews when expanded
  useEffect(() => {
    if (showReviews && reviews.length === 0) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      loadReviews(1);
    }
  }, [showReviews, loadReviews, reviews.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { clearSelectedProduct(); };
  }, [clearSelectedProduct]);

  if (loading || isProductLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <BackButton fallbackRoute="/products" />
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <div className="lg:sticky lg:top-8 lg:self-start">
              <div className="aspect-square animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-600 dark:bg-gray-600" />
            </div>
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-3">
                <div className="h-8 w-3/4 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-600 dark:bg-gray-600" />
                <div className="h-5 w-1/2 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-600 dark:bg-gray-600" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-600 dark:bg-gray-600" />
                ))}
              </div>
              <div className="h-48 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-600 dark:bg-gray-600" />
              <div className="h-32 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-600 dark:bg-gray-600" />
              <div className="h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-600 dark:bg-gray-600" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !selectedProduct) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center animate-fade-in">
        <div className="flex flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30">
            <AlertTriangle size={36} className="text-red-300" />
          </div>
          <h2 className="mt-6 text-xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
            {error ?? "Product not found"}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            This product may have been removed or is no longer available.
          </p>
          <div className="mt-8 flex gap-3">
            <BackButton fallbackRoute="/products" label="Go Back" />
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-800 active:scale-95"
            >
              <ArrowLeft size={16} />
              Browse Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const product = selectedProduct;
  const isInWishlist = wishlistItems.some((item) => item.id === productId);
  const wishlistItem = wishlistItems.find((item) => item.id === productId);

  const handleWishlistToggle = async () => {
    setWishlistToggling(true);
    try {
      if (isInWishlist && wishlistItem) {
        await removeWishlist(wishlistItem.wishlistItemId);
        toast.success("Removed from wishlist");
      } else {
        await addWishlist(productId);
        toast.success("Added to wishlist");
      }
      await getWishlist();
    } catch {
      toast.error("Failed to update wishlist");
    } finally {
      setWishlistToggling(false);
    }
  };

  const handleAddToCart = async (variantId: string) => {
    try {
      await addItem(variantId, 1);
      setAddedVariantId(variantId);
      toast.success("Added to cart!");
      setTimeout(() => setAddedVariantId(null), 2000);
    } catch {
      toast.error("Failed to add to cart");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
      {/* Top Bar */}
      <div className="border-b border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Products", href: "/products" },
              { label: product.category.name, href: `/categories/${product.category.id}` },
              { label: product.name },
            ]}
          />
          <div className="mt-2">
            <BackButton fallbackRoute="/products" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: Gallery */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <ImageGallery images={product.images} name={product.name} />
          </div>

          {/* Right: Product Info */}
          <div className="space-y-6">
            {/* Title & Status */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                    {product.name}
                  </h1>
                  {product.nameHi && (
                    <p className="mt-1 text-lg text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{product.nameHi}</p>
                  )}
                </div>
                <button
                  onClick={handleWishlistToggle}
                  disabled={wishlistToggling}
                  className={`rounded-xl p-2.5 transition-all ${
                    isInWishlist
                      ? "bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30 text-red-500 dark:text-red-400 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 dark:bg-red-900/50 dark:hover:bg-red-900/50"
                      : "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:bg-gray-600 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300 dark:hover:text-gray-300"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                  title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
                >
                  {wishlistToggling ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Heart size={20} className={isInWishlist ? "fill-red-500" : ""} />
                  )}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${getStatusColor(product.status)}`}>
                  {product.status.replace(/_/g, " ")}
                </span>
                {product.seasonalFlag && (
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/50 dark:bg-emerald-900/50 px-3 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 dark:text-emerald-300">
                    Seasonal
                  </span>
                )}
                <span className="rounded-full bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30 px-3 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 dark:text-blue-400">
                  {product.category.name}
                </span>
              </div>
            </div>

            {/* Quick Meta Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: Tag, label: "Unit", value: product.unitOfMeasure ?? "—" },
                { icon: Ruler, label: "HSN Code", value: product.hsnCode ?? "—" },
                { icon: Percent, label: "GST", value: product.gstRate ? `${product.gstRate}%` : "—" },
                { icon: Hash, label: "Views", value: product._count.views.toString() },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-white dark:bg-gray-800 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:border-gray-700 p-3">
                  <div className="flex items-center gap-2">
                    <item.icon size={13} className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      {item.label}
                    </p>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Variants & Add to Cart */}
            {product.variants.length > 0 && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-4">
                  Choose Variant
                </h2>
                <VariantSelector
                  variants={product.variants}
                  selectedVariantId={selectedVariantId}
                  onSelect={setSelectedVariantId}
                  onAddToCart={handleAddToCart}
                  isAdding={isAdding}
                  addedVariantId={addedVariantId}
                />
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-3">
                  Description
                </h2>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300 dark:text-gray-300 whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

            {/* Specifications */}
            {product.attributes.length > 0 && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-3">
                  Specifications
                </h2>
                <div className="divide-y divide-gray-100 dark:divide-gray-700 dark:divide-gray-700">
                  {product.attributes.map((attr) => (
                    <div key={attr.id} className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">
                        {attr.name}
                        {attr.nameHi && (
                          <span className="ml-1 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">({attr.nameHi})</span>
                        )}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                        {attr.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Applicable Crops */}
            {product.applicableCrops.length > 0 && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-3">
                  Suitable For Crops
                </h2>
                <div className="flex flex-wrap gap-2">
                  {product.applicableCrops.map((crop) => (
                    <span
                      key={crop}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${getCropColor(crop)}`}
                    >
                      {crop}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Vendor Info */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 mb-3">
                Sold By
              </h2>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 dark:bg-emerald-900/50">
                  <Store size={24} className="text-emerald-700 dark:text-emerald-400 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                    {product.vendor.businessName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    {product.vendor.user.fullName}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      product.vendor.kycStatus === "APPROVED"
                        ? "bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 dark:text-emerald-400"
                        : "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 dark:text-amber-400"
                    }`}>
                      {product.vendor.kycStatus === "APPROVED" ? (
                        <CheckCircle2 size={10} />
                      ) : (
                        <AlertTriangle size={10} />
                      )}
                      KYC: {product.vendor.kycStatus}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reviews Section */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
              <ProductReviews productId={product.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
