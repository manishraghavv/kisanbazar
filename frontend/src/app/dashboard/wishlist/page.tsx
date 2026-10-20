"use client";

import { useEffect, useState } from "react";
import { useWishlistStore } from "@/stores/wishlistStore";
import { toast } from "sonner";
import {
  Heart,
  ShoppingCart,
  Trash2,
  Loader2,
  Package,
  Star,
  Eye,
} from "lucide-react";
import Link from "next/link";
import type { ProductListItem } from "@/types/auth";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function getLowestPrice(variants: { sellingPrice: number }[]) {
  if (variants.length === 0) return 0;
  return Math.min(...variants.map((v) => v.sellingPrice));
}

// ─── Wishlist Card ───────────────────────────────────────────────────────────

function WishlistCard({
  product,
  wishlistItemId,
  onRemove,
  onMoveToCart,
  isMoving,
}: {
  product: ProductListItem;
  wishlistItemId: string;
  onRemove: () => void;
  onMoveToCart: () => void;
  isMoving: boolean;
}) {
  const lowestPrice = getLowestPrice(product.variants);
  const imageUrl = product.images[0]?.imageUrl;

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-lg dark:shadow-gray-950/30 hover:border-rose-200">
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

        {/* Wishlist heart badge */}
        <div className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-gray-800 dark:bg-gray-800/90 shadow-sm dark:shadow-gray-950/30 backdrop-blur-sm">
          <Heart size={15} className="fill-red-500 text-red-500 dark:text-red-400" />
        </div>

        {/* Quick actions overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
          <button
            onClick={onMoveToCart}
            disabled={isMoving}
            className="flex items-center gap-1.5 rounded-lg bg-white dark:bg-gray-800 dark:bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 shadow transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400 disabled:opacity-50"
          >
            {isMoving ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <ShoppingCart size={13} />
            )}
            Add to Cart
          </button>
          <button
            onClick={onRemove}
            className="flex items-center gap-1.5 rounded-lg bg-white dark:bg-gray-800 dark:bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 shadow transition-colors hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 hover:text-red-600"
          >
            <Trash2 size={13} />
            Remove
          </button>
        </div>
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
              <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                {product._count.reviews}
              </span>
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 line-clamp-1">
          {product.vendor.businessName}
        </p>

        {lowestPrice > 0 && (
          <p className="mt-auto pt-3 text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
            {formatCurrency(lowestPrice)}
          </p>
        )}

        {/* Actions row */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={onMoveToCart}
            disabled={isMoving}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-800 disabled:opacity-50"
          >
            {isMoving ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <ShoppingCart size={13} />
            )}
            Add to Cart
          </button>
          <button
            onClick={onRemove}
            className="flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-300 transition-colors hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 hover:text-red-600"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WishlistPage() {
  const { items, isLoading, getWishlist, removeItem, moveToCart } =
    useWishlistStore();
  const [movingIds, setMovingIds] = useState<Set<string>>(new Set());
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    getWishlist().catch(() => toast.error("Failed to load wishlist"));
  }, [getWishlist]);

  const handleMoveToCart = async (itemId: string) => {
    setMovingIds((prev) => new Set(prev).add(itemId));
    try {
      await moveToCart(itemId);
      toast.success("Moved to cart");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to move to cart");
    } finally {
      setMovingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleRemove = async (itemId: string) => {
    setRemovingId(itemId);
    try {
      await removeItem(itemId);
      toast.success("Removed from wishlist");
    } catch {
      toast.error("Failed to remove item");
    } finally {
      setRemovingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-rose-50">
            <Heart size={44} className="text-rose-300" />
          </div>
          <h2 className="mt-6 text-xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
            Your wishlist is empty
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            Save products you love to your wishlist
          </p>
          <Link
            href="/products"
            className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-800"
          >
            <Eye size={16} />
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">My Wishlist</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
          {items.length} item{items.length !== 1 ? "s" : ""} saved
        </p>
      </div>

      {/* Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((product) => {
          const wishlistItemId = product.wishlistItemId;
          return (
            <WishlistCard
              key={wishlistItemId}
              product={product}
              wishlistItemId={wishlistItemId}
              onRemove={() => handleRemove(wishlistItemId)}
              onMoveToCart={() => handleMoveToCart(wishlistItemId)}
              isMoving={movingIds.has(wishlistItemId)}
            />
          );
        })}
      </div>

      {/* Footer link */}
      <div className="mt-8 text-center">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 transition-colors hover:text-emerald-800 dark:hover:text-emerald-300"
        >
          <Eye size={14} />
          Browse more products
        </Link>
      </div>
    </div>
  );
}
