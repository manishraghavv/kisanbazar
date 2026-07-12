"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { useAuthStore } from "@/stores/authStore";
import {
  Package,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Truck,
  Clock,
  CheckCircle2,
  RefreshCw,
  XCircle,
  RotateCcw,
  Plus,
  Send,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import type { OrderListItem, OrderDetail, OrderStatus } from "@/types/auth";

// ─── Status config ───────────────────────────────────────────────────────────

const STATUSES: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PROCESSING", label: "Processing" },
  { value: "PACKED", label: "Packed" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "RETURNED", label: "Returned" },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  PENDING: { bg: "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", icon: Clock },
  CONFIRMED: { bg: "bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", icon: CheckCircle2 },
  PROCESSING: { bg: "bg-indigo-50 dark:bg-indigo-900/30 dark:bg-indigo-900/30", text: "text-indigo-800", icon: RefreshCw },
  PACKED: { bg: "bg-purple-50 dark:bg-purple-900/30 dark:bg-purple-900/30", text: "text-purple-800", icon: Package },
  SHIPPED: { bg: "bg-cyan-50 dark:bg-cyan-900/30 dark:bg-cyan-900/30", text: "text-cyan-800", icon: Truck },
  DELIVERED: { bg: "bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300", icon: CheckCircle2 },
  CANCELLED: { bg: "bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30", text: "text-red-800", icon: XCircle },
  RETURNED: { bg: "bg-orange-50 dark:bg-orange-900/30 dark:bg-orange-900/30", text: "text-orange-800", icon: RotateCcw },
};

// Valid transitions a vendor can make
const VALID_TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  PENDING: [{ value: "CONFIRMED", label: "Confirm Order" }],
  CONFIRMED: [{ value: "PROCESSING", label: "Start Processing" }],
  PROCESSING: [{ value: "PACKED", label: "Mark as Packed" }],
  PACKED: [{ value: "SHIPPED", label: "Mark as Shipped" }],
  SHIPPED: [{ value: "DELIVERED", label: "Mark as Delivered" }],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status];
  if (!style) return <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{status.replace(/_/g, " ")}</span>;
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.bg} ${style.text}`}>
      <Icon size={11} />{status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Shipment Form ────────────────────────────────────────────────────────────

function ShipmentForm({
  orderId,
  onCreated,
  onCancel,
}: {
  orderId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [logisticsPartner, setLogisticsPartner] = useState("");
  const [awbNumber, setAwbNumber] = useState("");
  const [deliveryEta, setDeliveryEta] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logisticsPartner.trim()) { setError("Logistics partner is required"); return; }
    setIsSaving(true);
    setError("");
    try {
      await apiClient.post(`/orders/${orderId}/shipments`, {
        logisticsPartner: logisticsPartner.trim(),
        awbNumber: awbNumber.trim() || undefined,
        deliveryEta: deliveryEta || undefined,
      });
      toast.success("Shipment created");
      onCreated();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message ?? "Failed to create shipment");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-4 space-y-3">
      <p className="text-xs font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 uppercase tracking-wider">Create Shipment</p>
      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">Logistics Partner *</label>
        <select value={logisticsPartner} onChange={(e) => setLogisticsPartner(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400">
          <option value="">Select partner...</option>
          <option value="Delhivery">Delhivery</option>
          <option value="Blue Dart">Blue Dart</option>
          <option value="DTDC">DTDC</option>
          <option value="Ekart">Ekart</option>
          <option value="India Post">India Post</option>
          <option value="Shadowfax">Shadowfax</option>
          <option value="XpressBees">XpressBees</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">AWB Number</label>
        <input value={awbNumber} onChange={(e) => setAwbNumber(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 font-mono"
          placeholder="Optional tracking number" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">Delivery ETA</label>
        <input type="date" value={deliveryEta} onChange={(e) => setDeliveryEta(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400" />
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700">
          Cancel
        </button>
        <button type="submit" disabled={isSaving}
          className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
          {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          {isSaving ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
}

// ─── Shipment Event Form ───────────────────────────────────────────────────────

function ShipmentEventForm({
  shipmentId,
  onCreated,
  onCancel,
}: {
  shipmentId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [eventStatus, setEventStatus] = useState("");
  const [location, setLocation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventStatus.trim()) { setError("Event status is required"); return; }
    setIsSaving(true);
    setError("");
    try {
      await apiClient.post(`/shipments/${shipmentId}/events`, {
        eventStatus: eventStatus.trim(),
        location: location.trim() || undefined,
      });
      toast.success("Event added");
      onCreated();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message ?? "Failed to add event");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-4 space-y-3">
      <p className="text-xs font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 uppercase tracking-wider">Add Tracking Event</p>
      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">Event Status *</label>
        <input value={eventStatus} onChange={(e) => setEventStatus(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400"
          placeholder="e.g., Picked up, In transit, Out for delivery" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">Location</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400"
          placeholder="e.g., Mumbai Warehouse" />
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700">
          Cancel
        </button>
        <button type="submit" disabled={isSaving}
          className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
          {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          {isSaving ? "Adding..." : "Add Event"}
        </button>
      </div>
    </form>
  );
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────

function OrderDetailModal({
  orderId,
  onClose,
  onStatusUpdated,
}: {
  orderId: string;
  onClose: () => void;
  onStatusUpdated: () => void;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [statusRemarks, setStatusRemarks] = useState("");
  const [showShipmentForm, setShowShipmentForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: OrderDetail }>(`/orders/${orderId}`);
      setOrder(res.data.data);
    } catch {
      toast.error("Failed to load order");
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadOrder(); }, [loadOrder]);

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdatingStatus(newStatus);
    try {
      await apiClient.put(`/orders/${orderId}/status`, {
        status: newStatus,
        remarks: statusRemarks || undefined,
      });
      toast.success(`Order ${newStatus.toLowerCase()}`);
      setStatusRemarks("");
      await loadOrder();
      onStatusUpdated();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to update status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-8 shadow-2xl dark:shadow-gray-950/50">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
        </div>
      </div>
    );
  }

  if (!order) return null;

  const transitions = VALID_TRANSITIONS[order.status] || [];
  const hasShipment = (order.shipments?.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/50">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
              <Package size={20} className="text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{order.orderNumber}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                {order.user.fullName} · {order.user.phoneNumber} · {formatDate(order.createdAt)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status + Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Status:</span>
              <StatusBadge status={order.status} />
            </div>
            <div className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
              {formatCurrency(order.totalAmount)}
            </div>
          </div>

          {/* Status Update Buttons */}
          {transitions.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Update Status
              </p>
              <div className="flex flex-wrap gap-2">
                {transitions.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => handleStatusUpdate(t.value)}
                    disabled={updatingStatus === t.value}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow transition-all hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {updatingStatus === t.value ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <ChevronRight size={13} />
                    )}
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <input
                  value={statusRemarks}
                  onChange={(e) => setStatusRemarks(e.target.value)}
                  placeholder="Add a remark (optional)..."
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 px-3 py-2 text-xs outline-none focus:border-emerald-500 dark:focus:border-emerald-400"
                />
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Items ({order.items.length})</h3>
            <div className="divide-y divide-gray-100 dark:divide-gray-700 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{item.variant.product.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{item.variant.sku} · Qty: {item.quantity}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(item.unitPrice * item.quantity)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Subtotal</span><span className="font-medium">{formatCurrency(order.subtotal)}</span></div>
              {order.deliveryCharge > 0 && <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Delivery</span><span className="font-medium">{formatCurrency(order.deliveryCharge)}</span></div>}
              <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">GST</span><span className="font-medium">{formatCurrency(order.gstAmount)}</span></div>
              {order.discountAmount > 0 && <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Discount</span><span className="font-medium text-emerald-700 dark:text-emerald-400">-{formatCurrency(order.discountAmount)}</span></div>}
              <div className="border-t border-gray-200 dark:border-gray-700 dark:border-gray-700 pt-1.5 flex justify-between font-bold"><span>Total</span><span>{formatCurrency(order.totalAmount)}</span></div>
            </div>
          </div>

          {/* Customer & Address */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Customer</p>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-3">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{order.user.fullName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{order.user.phoneNumber}</p>
              </div>
            </div>
            {order.address && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Shipping To</p>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-3">
                  {order.address.label && <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{order.address.label}</p>}
                  <p className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">{order.address.addressLine1}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{order.address.city}, {order.address.state} — {order.address.pincode}</p>
                </div>
              </div>
            )}
          </div>

          {/* Payment */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Payment</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{order.paymentMethod.replace(/_/g, " ")}</span>
              {order.payments && order.payments.length > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  · {order.payments.filter(p => p.status === "SUCCESS").length} paid
                </span>
              )}
            </div>
          </div>

          {/* Shipments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Shipments</p>
              {order.status === "PACKED" && !hasShipment && (
                <button onClick={() => setShowShipmentForm(true)}
                  className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800">
                  <Plus size={12} /> Create Shipment
                </button>
              )}
            </div>

            {showShipmentForm && (
              <div className="mb-3">
                <ShipmentForm orderId={order.id} onCreated={() => { setShowShipmentForm(false); loadOrder(); }} onCancel={() => setShowShipmentForm(false)} />
              </div>
            )}

            {hasShipment ? (
              <div className="space-y-2">
                {order.shipments?.map((shipment) => (
                  <div key={shipment.id} className="rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Truck size={14} className="text-cyan-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{shipment.logisticsPartner ?? "Shipment"}</p>
                          {shipment.awbNumber && <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-mono">AWB: {shipment.awbNumber}</p>}
                        </div>
                      </div>
                      <button onClick={() => setShowEventForm(showEventForm === shipment.id ? null : shipment.id)}
                        className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300">
                        {showEventForm === shipment.id ? "Hide" : "Add Event"} {showEventForm === shipment.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>

                    {showEventForm === shipment.id && (
                      <div className="border-t border-gray-100 dark:border-gray-700 dark:border-gray-700 px-4 py-3">
                        <ShipmentEventForm shipmentId={shipment.id} onCreated={() => loadOrder()} onCancel={() => setShowEventForm(null)} />
                      </div>
                    )}

                    {shipment.events && shipment.events.length > 0 && (
                      <div className="border-t border-gray-100 dark:border-gray-700 dark:border-gray-700 px-4 py-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Tracking Events</p>
                        <div className="space-y-2">
                          {shipment.events.map((event) => (
                            <div key={event.id} className="flex items-start gap-2">
                              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                              <div>
                                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{event.eventStatus}</p>
                                {event.location && <p className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{event.location}</p>}
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatDateTime(event.eventTime)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : order.status !== "PACKED" && (
              <p className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 italic">No shipments yet</p>
            )}
          </div>

          {/* Cancellation Reason */}
          {order.cancellationReason && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">Cancellation Reason</p>
              <p className="mt-1 text-sm text-red-800">{order.cancellationReason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onViewDetail,
}: {
  order: OrderListItem;
  onViewDetail: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{order.orderNumber}</p>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {order.user.fullName} · {order.user.phoneNumber}
          </p>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {order.items.length} item{order.items.length !== 1 ? "s" : ""} · {formatDate(order.createdAt)} · {order.paymentMethod}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(order.totalAmount)}</p>
          <button onClick={onViewDetail}
            className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 px-3 py-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:border-emerald-300 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
            <Eye size={13} /> Manage
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorOrdersPage() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async (p: number, status: OrderStatus | "") => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, limit: 15 };
      if (status) params.status = status;

      const res = await apiClient.get<{
        success: boolean;
        data: OrderListItem[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/orders", { params });

      setOrders(res.data.data);
      setTotal(res.data.pagination.total);
      setTotalPages(res.data.pagination.totalPages);
      setPage(res.data.pagination.page);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadOrders(page, statusFilter);
  }, [page, statusFilter, loadOrders]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleFilterChange = (s: OrderStatus | "") => {
    setStatusFilter(s);
    setPage(1);
  };

  const handlePageChange = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  if (!user || user.role !== "VENDOR") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <AlertTriangle size={28} className="mx-auto text-gray-300" />
        <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Access Denied</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Only vendors can access this page</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Orders</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
          Manage orders containing your products
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-1.5 pb-2">
          {STATUSES.map((s) => {
            const active = statusFilter === s.value;
            return (
              <button
                key={s.value}
                onClick={() => handleFilterChange(s.value)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  active ? "bg-emerald-700 text-white shadow-sm dark:shadow-gray-950/30" : "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-200 dark:bg-gray-600"
                }`}
              >
                {s.label} {active && total > 0 && <span className="ml-1 opacity-70">({total})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
        </div>
      )}

      {/* Orders list */}
      {!isLoading && (
        <>
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
                <Package size={28} className="text-gray-300" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {statusFilter ? "No orders match this status" : "No orders yet"}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Orders containing your products will appear here
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onViewDetail={() => setSelectedOrderId(order.id)}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 px-4 py-3 shadow-sm dark:shadow-gray-950/30">
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Page {page} of {totalPages} · {total} orders</p>
                  <div className="flex gap-1">
                    <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1}
                      className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40">
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const start = Math.max(1, page - 2);
                      const p = start + i;
                      if (p > totalPages) return null;
                      return (
                        <button key={p} onClick={() => handlePageChange(p)}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold ${p === page ? "bg-emerald-700 text-white" : "text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"}`}>
                          {p}
                        </button>
                      );
                    })}
                    <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}
                      className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onStatusUpdated={() => loadOrders(page, statusFilter)}
        />
      )}
    </div>
  );
}
