"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import apiClient from "@/lib/api-client";
import { CheckCircle2, Package, ShoppingBag, Loader2, Sparkles, Calendar, Copy, AlertTriangle } from "lucide-react";
import type { OrderDetail } from "@/types/auth";

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrderConfirmationPage() {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const orderId = sessionStorage.getItem("lastOrderId");
    const orderNumber = sessionStorage.getItem("lastOrderNumber");

    if (!orderId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("No recent order found");
       
      setIsLoading(false);
      return;
    }

    apiClient
      .get<{ success: boolean; data: OrderDetail }>(`/orders/${orderId}`)
      .then((res) => {
        setOrder(res.data.data);
        setIsLoading(false);
      })
      .catch(() => {
        // If API fails, show at least the order number
        setError(null);
        setIsLoading(false);
        // Create a minimal order object from session data
        if (orderNumber) {
          setOrder({
            id: orderId,
            orderNumber,
            totalAmount: 0,
            subtotal: 0,
            gstAmount: 0,
            deliveryCharge: 0,
            discountAmount: 0,
            paymentMethod: "",
            status: "PENDING",
            items: [],
            user: { id: "", fullName: "", phoneNumber: "" },
            addressId: "",
            address: {} as import("@/types/auth").Address,
            payments: [],
            shipments: [],
            statusHistory: [],
            returns: [],
            refunds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      });
  }, []);

  const handleCopyOrderNumber = () => {
    if (order?.orderNumber) {
      navigator.clipboard.writeText(order.orderNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <div className="flex flex-col items-center justify-center">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
            <AlertTriangle size={28} className="text-gray-300" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
            {error ?? "Order not found"}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            We couldn&apos;t find your recent order details
          </p>
          <Link
            href="/dashboard/orders"
            className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-800"
          >
            <Package size={16} />
            View All Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Success Banner */}
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white p-8 text-center shadow-sm dark:shadow-gray-950/30">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600">
            <CheckCircle2 size={32} className="text-white" />
          </div>
        </div>

        <h1 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
          Order Placed Successfully!
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
          Thank you for your order. We&apos;ll start processing it right away.
        </p>

        {/* Order Number */}
        <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-3 shadow-md dark:shadow-gray-950/30">
          <Package size={16} className="text-emerald-400" />
          <span className="text-sm font-bold text-white">
            #{order.orderNumber}
          </span>
          <button
            onClick={handleCopyOrderNumber}
            className="ml-1 rounded-md p-1 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-700 hover:text-white"
            title="Copy order number"
          >
            {copied ? (
              <CheckCircle2 size={14} className="text-emerald-400" />
            ) : (
              <Copy size={14} />
            )}
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
          <Calendar size={12} />
          <span>Placed on {formatDate(order.createdAt)}</span>
        </div>
      </div>

      {/* Next Steps */}
      <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">What happens next?</h3>
        <div className="mt-4 space-y-4">
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">1</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Order Confirmed</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Your order will be confirmed by the vendor shortly
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">2</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Processing & Packing</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                The vendor will prepare your items for dispatch
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">3</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Shipped & Delivered</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                You&apos;ll receive tracking details once shipped
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Order Summary */}
      {order.totalAmount > 0 && (
        <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Order Summary</h3>
          <div className="mt-4 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Items</span>
              <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{order.items.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Subtotal</span>
              <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Discount</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  -{formatCurrency(order.discountAmount)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Delivery</span>
              <span className={order.deliveryCharge === 0 ? "text-emerald-700 dark:text-emerald-400 font-medium" : "font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100"}>
                {order.deliveryCharge === 0 ? "Free" : formatCurrency(order.deliveryCharge)}
              </span>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700 dark:border-gray-700 pt-2.5">
              <div className="flex justify-between text-base font-bold">
                <span className="text-gray-900 dark:text-gray-100 dark:text-gray-100">Total Paid</span>
                <span className="text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/dashboard/orders"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow transition-all hover:bg-emerald-800"
        >
          <Package size={16} />
          View All Orders
        </Link>
        <Link
          href="/products"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-5 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50"
        >
          <ShoppingBag size={16} />
          Continue Shopping
        </Link>
      </div>

      {/* Trust note */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
        <Sparkles size={12} className="text-emerald-500" />
        <span>
          You&apos;ll receive an order confirmation on your registered phone number
        </span>
      </div>
    </div>
  );
}
