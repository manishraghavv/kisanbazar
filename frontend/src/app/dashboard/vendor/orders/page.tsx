"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Loader2, Package, Send, Truck, XCircle } from "lucide-react";
import apiClient from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/razorpay";
import { downloadPdf } from "@/lib/download";
import { formatRupees, isZero } from "@/lib/money";
import { stateNameFromCode } from "@/lib/indianStates";
import { StatusPill } from "@/components/orders/SubOrdersSection";
import type { OrderStatus, SubOrder } from "@/types/auth";

/**
 * A seller's orders. The API returns only THIS seller's sub-orders: a customer's order that mixes several sellers
 * shows up here as one entry per seller, and everything on this page acts on this seller's part only.
 */

const FILTERS: { value: OrderStatus | ""; label: string }[] = [
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

const NEXT: Record<string, { value: string; label: string }> = {
  PENDING: { value: "CONFIRMED", label: "Accept order" },
  CONFIRMED: { value: "PROCESSING", label: "Start processing" },
  PROCESSING: { value: "PACKED", label: "Mark packed" },
  PACKED: { value: "SHIPPED", label: "Mark shipped" },
  SHIPPED: { value: "DELIVERED", label: "Mark delivered" },
};
const REJECTABLE = ["PENDING", "CONFIRMED", "PROCESSING"];
const CAN_SHIP = ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED"];

const formatDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function ShipmentForm({ subOrderId, onDone }: { subOrderId: string; onDone: () => void }) {
  const [partner, setPartner] = useState("");
  const [awb, setAwb] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiClient.post(`/sub-orders/${subOrderId}/shipments`, {
        logisticsPartner: partner.trim() || undefined,
        awbNumber: awb.trim() || undefined,
      });
      toast.success("Shipment added");
      onDone();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not add the shipment"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/40">
      <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
        Courier
        <input value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="e.g. Delhivery" className="mt-1 block w-40 rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900" />
      </label>
      <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
        AWB / tracking no.
        <input value={awb} onChange={(e) => setAwb(e.target.value)} className="mt-1 block w-44 rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900" />
      </label>
      <button disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Truck size={12} />} Add shipment
      </button>
    </form>
  );
}

function TrackingEventForm({ shipmentId, onDone }: { shipmentId: string; onDone: () => void }) {
  const [status, setStatus] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiClient.post(`/shipments/${shipmentId}/events`, {
        eventStatus: status.trim(),
        location: location.trim() || undefined,
        source: "manual",
      });
      setStatus("");
      setLocation("");
      onDone();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not add the update"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="mt-2 flex flex-wrap items-end gap-2">
      <input value={status} onChange={(e) => setStatus(e.target.value)} required placeholder="Update, e.g. Out for delivery" className="w-56 rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
      <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="w-36 rounded-lg border border-gray-300 px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900" />
      <button disabled={busy || !status.trim()} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 dark:border-gray-600">
        <Send size={11} /> Post
      </button>
    </form>
  );
}

function SubOrderCard({ so, onChanged }: { so: SubOrder; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const next = NEXT[so.status];
  const taxInvoice = so.invoices.find((i) => i.type === "TAX_INVOICE");
  const openReturns = so.returns.filter((r) => ["REQUESTED", "APPROVED", "RECEIVED"].includes(r.status)).length;

  const update = async (status: string, remarks?: string) => {
    setBusy(true);
    try {
      const res = await apiClient.put<{ refund?: string }>(`/sub-orders/${so.id}/status`, { status, remarks });
      toast.success(status === "CANCELLED" ? "Order rejected and the customer is being refunded" : `Marked ${status.toLowerCase()}`);
      if (res.data.refund === "FAILED") toast.warning("The refund could not be started automatically; an admin will follow up.");
      setRejecting(false);
      setReason("");
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update the order"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-950/30">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{so.subOrderNumber}</h3>
            <StatusPill status={so.status} />
            {openReturns > 0 && (
              <Link href="/dashboard/vendor/returns" className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                {openReturns} return{openReturns > 1 ? "s" : ""} open
              </Link>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {so.order?.user?.fullName} · {so.order?.user?.phoneNumber} · {formatDate(so.createdAt)} · {so.order?.paymentMethod.replace(/_/g, " ")}
          </p>
          {so.order?.address && (
            <p className="text-xs text-gray-400">
              Ship to {so.order.address.city}, {stateNameFromCode(so.order.address.stateCode) || so.order.address.state} · {so.isInterState ? "IGST" : "CGST+SGST"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">{formatRupees(so.totalAmount)}</p>
          <button onClick={() => setOpen(!open)} aria-label="Toggle details" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t border-gray-100 px-5 py-4 dark:border-gray-700">
          <div className="space-y-1.5">
            {so.items.map((i) => (
              <div key={i.id} className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-200">
                  {i.variant.product.name} <span className="text-gray-400">({i.variant.variantName ?? "Default"}) × {i.quantity}</span>
                </span>
                <span className="font-medium">{formatRupees(Number(i.unitPrice) * i.quantity)}</span>
              </div>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 border-t border-gray-100 pt-2 text-xs text-gray-500 dark:border-gray-700 sm:max-w-xs">
              {!isZero(so.discountAmount) && (<><span>Discount</span><span className="text-right">−{formatRupees(so.discountAmount)}</span></>)}
              <span>Taxable value</span><span className="text-right">{formatRupees(so.taxableValue)}</span>
              {!isZero(so.cgstAmount) && (<><span>CGST</span><span className="text-right">{formatRupees(so.cgstAmount)}</span></>)}
              {!isZero(so.sgstAmount) && (<><span>SGST</span><span className="text-right">{formatRupees(so.sgstAmount)}</span></>)}
              {!isZero(so.igstAmount) && (<><span>IGST</span><span className="text-right">{formatRupees(so.igstAmount)}</span></>)}
              <span>Delivery</span><span className="text-right">{isZero(so.deliveryCharge) ? "Free" : formatRupees(so.deliveryCharge)}</span>
            </div>
          </div>

          {so.shipments.map((s) => (
            <div key={s.id} className="rounded-lg border border-gray-200 p-3 text-xs dark:border-gray-700">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {s.logisticsPartner ?? "Shipment"} {s.awbNumber && <span className="font-mono text-gray-500">· {s.awbNumber}</span>}
              </p>
              {s.events.slice(0, 3).map((e) => (
                <p key={e.id} className="text-gray-500">{e.eventStatus}{e.location ? ` — ${e.location}` : ""}</p>
              ))}
              <TrackingEventForm shipmentId={s.id} onDone={onChanged} />
            </div>
          ))}
          {CAN_SHIP.includes(so.status) && <ShipmentForm subOrderId={so.id} onDone={onChanged} />}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-700">
        {next && (
          <button onClick={() => update(next.value)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-60">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Package size={12} />} {next.label}
          </button>
        )}
        {REJECTABLE.includes(so.status) && !rejecting && (
          <button onClick={() => setRejecting(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30">
            <XCircle size={12} /> Reject / cancel
          </button>
        )}
        {taxInvoice && (
          <button
            onClick={() => downloadPdf(`/sub-orders/${so.id}/invoice`, `invoice-${taxInvoice.invoiceNumber.replace(/\//g, "-")}.pdf`).catch(() => toast.error("Could not download the invoice"))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold dark:border-gray-600"
          >
            <Download size={12} /> {taxInvoice.invoiceNumber}
          </button>
        )}
        {rejecting && (
          <div className="flex w-full flex-wrap items-center gap-2">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason shown to the customer (required)" className="min-w-[14rem] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-900" />
            <button onClick={() => update("CANCELLED", reason.trim())} disabled={busy || reason.trim().length < 3} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
              Confirm rejection
            </button>
            <button onClick={() => setRejecting(false)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold dark:border-gray-600">Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VendorOrdersPage() {
  const [subOrders, setSubOrders] = useState<SubOrder[]>([]);
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 10 };
      if (status) params.status = status;
      const res = await apiClient.get<{ success: boolean; data: SubOrder[]; pagination: { totalPages: number } }>("/sub-orders", { params });
      setSubOrders(res.data.data);
      setTotalPages(Math.max(res.data.pagination.totalPages, 1));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load your orders"));
    } finally {
      setIsLoading(false);
    }
  }, [page, status]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Your part of each customer order. Other sellers&apos; items are never shown here.</p>
        </div>
        <Link href="/dashboard/vendor/returns" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-gray-600">
          Returns
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value || "all"}
            onClick={() => {
              setStatus(f.value);
              setPage(1);
            }}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              status === f.value ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-emerald-700" /></div>
      ) : subOrders.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500">No orders here yet.</p>
      ) : (
        <div className="space-y-4">
          {subOrders.map((so) => (
            <SubOrderCard key={so.id} so={so} onChanged={load} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-gray-300 p-2 disabled:opacity-40 dark:border-gray-600" aria-label="Previous page"><ChevronLeft size={16} /></button>
          <span className="text-sm text-gray-600 dark:text-gray-300">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-gray-300 p-2 disabled:opacity-40 dark:border-gray-600" aria-label="Next page"><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
}
