"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import {
  ShoppingCart,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Loader2,
  Package,
  ArrowLeft,
  IndianRupee,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Cart Item Row ───────────────────────────────────────────────────────────

function CartItemRow({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: import("@/types/auth").CartItem;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
}) {
  const imageUrl = item.variant.product.images[0]?.imageUrl;
  const lineTotal = item.variant.sellingPrice * item.quantity;

  return (
    <div className="flex items-start gap-4 border-b border-gray-100 dark:border-gray-700 dark:border-gray-700 px-4 py-4 last:border-0 sm:px-6">
      {/* Image */}
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Package size={24} className="text-gray-300" />
        )}
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <Link
          href={`/products`}
          className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 transition-colors hover:text-emerald-700 dark:hover:text-emerald-400 line-clamp-1"
        >
          {item.variant.product.name}
        </Link>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
          {item.variant.variantName ?? "Default"} · {item.variant.sku}
        </p>

        <div className="mt-2 flex items-center gap-3">
          {/* Quantity controls */}
          <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700">
            <button
              onClick={() => {
                if (item.quantity <= 1) {
                  onRemove(item.id);
                } else {
                  onUpdateQuantity(item.id, item.quantity - 1);
                }
              }}
              className="flex h-8 w-8 items-center justify-center text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-200 rounded-l-lg"
            >
              <Minus size={13} />
            </button>
            <span className="flex h-8 w-10 items-center justify-center text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 select-none">
              {item.quantity}
            </span>
            <button
              onClick={() => {
                if (item.quantity < 99) {
                  onUpdateQuantity(item.id, item.quantity + 1);
                }
              }}
              disabled={item.quantity >= 99}
              className="flex h-8 w-8 items-center justify-center text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-200 dark:text-gray-200 rounded-r-lg disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={13} />
            </button>
          </div>

          <button
            onClick={() => onRemove(item.id)}
            className="flex items-center gap-1 rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 hover:text-red-600"
            title="Remove"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Mobile price */}
        <p className="mt-2 text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 sm:hidden">
          {formatCurrency(lineTotal)}
        </p>
      </div>

      {/* Price (desktop) */}
      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
          {formatCurrency(item.variant.sellingPrice)} × {item.quantity}
        </p>
        <p className="mt-0.5 text-base font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
          {formatCurrency(lineTotal)}
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CartPage() {
  const { cart, isLoading, getCart, updateItemQuantity, removeItem, clearCart } =
    useCartStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load cart on mount
  useEffect(() => {
    getCart().catch(() => toast.error("Failed to load cart"));
  }, [getCart]);

  // ── Computed values ──

  const items = cart?.items ?? [];
  const subtotal = items.reduce(
    (sum, item) => sum + item.variant.sellingPrice * item.quantity,
    0,
  );

  const handleClearCart = async () => {
    try {
      await clearCart();
      toast.success("Cart cleared");
      setShowClearConfirm(false);
    } catch {
      toast.error("Failed to clear cart");
    }
  };

  // ── Loading ──

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
        </div>
      </div>
    );
  }

  // ── Empty state ──

  if (!cart || items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30">
            <ShoppingBag size={44} className="text-emerald-300" />
          </div>
          <h2 className="mt-6 text-xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Your cart is empty</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            Browse products and add items to your cart
          </p>
          <Link
            href="/products"
            className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-800"
          >
            <ShoppingCart size={16} />
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Shopping Cart</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {items.length} item{items.length !== 1 ? "s" : ""} · {formatCurrency(subtotal)}
          </p>
        </div>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-300 transition-colors hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 hover:text-red-600"
        >
          <Trash2 size={13} />
          Clear
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left: Cart Items ── */}
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30 lg:col-span-2">
          <div className="divide-y divide-gray-100 dark:divide-gray-700 dark:divide-gray-700">
            {items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                onUpdateQuantity={async (itemId, qty) => {
                  try {
                    await updateItemQuantity(itemId, qty);
                  } catch {
                    toast.error("Failed to update quantity");
                  }
                }}
                onRemove={async (itemId) => {
                  try {
                    await removeItem(itemId);
                    toast.success("Item removed");
                  } catch {
                    toast.error("Failed to remove item");
                  }
                }}
              />
            ))}
          </div>

          <Link
            href="/products"
            className="flex items-center gap-1.5 border-t border-gray-100 dark:border-gray-700 dark:border-gray-700 px-6 py-3 text-xs font-medium text-emerald-700 dark:text-emerald-400 transition-colors hover:text-emerald-800 dark:hover:text-emerald-300"
          >
            <ArrowLeft size={13} />
            Continue Shopping
          </Link>
        </div>

        {/* ── Right: Order Summary ── */}
        <div className="space-y-4">
          {/* Price Summary */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Order Summary</h3>
            <div className="mt-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Subtotal</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Items</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{items.length}</span>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700 dark:border-gray-700 pt-2.5">
                <div className="flex justify-between text-base font-bold">
                  <span className="text-gray-900 dark:text-gray-100 dark:text-gray-100">Estimated Total</span>
                  <span className="text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(subtotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Proceed to Checkout */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30">
            <Link
              href="/dashboard/cart/checkout"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow transition-all hover:bg-emerald-800"
            >
              <Sparkles size={18} />
              Proceed to Checkout
            </Link>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              <ChevronRight size={11} className="text-emerald-500" />
              <span>Address, payment &amp; coupon at checkout</span>
            </div>
          </div>

          {/* Trust badges */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-950/30">
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              <div className="flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600 dark:text-emerald-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span>Secure checkout</span>
              </div>
              <div className="flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-600 dark:text-emerald-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>Buyer protection</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clear Cart Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30">
              <Trash2 size={24} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-center text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Clear Cart?</h3>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">
              This will remove all {items.length} item{items.length !== 1 ? "s" : ""} from your cart.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50"
              >
                Cancel
              </button>
              <button
                onClick={handleClearCart}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-700"
              >
                <Trash2 size={16} />
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
