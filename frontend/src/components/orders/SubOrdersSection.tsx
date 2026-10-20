"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Package,
  Truck,
  Download,
  Loader2,
  XCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  RefreshCw,
  FileText,
} from "lucide-react";
import apiClient from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/razorpay";
import { downloadPdf } from "@/lib/download";
import { formatRupees, isZero } from "@/lib/money";
import type { OrderDetail, ReturnRecord, SubOrder, SubOrderShipment } from "@/types/auth";

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { cls: string; icon: React.ComponentType<{ size?: number }> }> = {
  PENDING: { cls: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  CONFIRMED: { cls: "bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: CheckCircle2 },
  PROCESSING: { cls: "bg-indigo-50 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300", icon: RefreshCw },
  PACKED: { cls: "bg-purple-50 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", icon: Package },
  SHIPPED: { cls: "bg-cyan-50 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300", icon: Truck },
  DELIVERED: { cls: "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
  CANCELLED: { cls: "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  RETURNED: { cls: "bg-orange-50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", icon: RotateCcw },
  REFUNDED: { cls: "bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300", icon: RefreshCw },
  REQUESTED: { cls: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  APPROVED: { cls: "bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: CheckCircle2 },
  RECEIVED: { cls: "bg-purple-50 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", icon: Package },
  CREDITED: { cls: "bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300", icon: RefreshCw },
  REJECTED: { cls: "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
};

export function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { cls: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200", icon: Clock };
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.cls}`}>
      <Icon size={11} />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

const formatDateTime = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ─── Shipment tracking ───────────────────────────────────────────────────────

function ShipmentCard({ shipment }: { shipment: SubOrderShipment }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-2">
          <Truck size={15} className="text-cyan-700 dark:text-cyan-400" />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{shipment.logisticsPartner ?? "Shipment"}</p>
            {shipment.awbNumber && <p className="font-mono text-xs text-gray-500 dark:text-gray-400">AWB: {shipment.awbNumber}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {shipment.currentStatus && (
            <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300">
              {shipment.currentStatus}
            </span>
          )}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>
      {open && (
        <div className="space-y-2 border-t border-gray-100 px-4 py-3 dark:border-gray-700">
          {shipment.events.length === 0 && <p className="text-xs italic text-gray-400">No tracking events yet</p>}
          {shipment.events.map((e) => (
            <div key={e.id} className="text-xs">
              <p className="font-medium text-gray-900 dark:text-gray-100">{e.eventStatus}</p>
              {e.location && <p className="text-gray-500 dark:text-gray-400">{e.location}</p>}
              <p className="text-gray-400">{formatDateTime(e.eventTime)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dialogs ─────────────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function CancelDialog({ subOrder, onClose, onDone }: { subOrder: SubOrder; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const res = await apiClient.post<{ refund?: string }>(`/sub-orders/${subOrder.id}/cancel`, { reason: reason.trim() });
      toast.success(res.data.refund === "REFUNDED" ? "Cancelled. Your refund has been started." : "Sub-order cancelled");
      if (res.data.refund === "FAILED") toast.warning("Refund could not be started automatically; support has been alerted.");
      onDone();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not cancel"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Cancel {subOrder.vendor.businessName}&apos;s part</h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        Only {subOrder.subOrderNumber} is cancelled; items from other sellers in this order are not affected.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Reason (required)"
        className="mt-4 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
      />
      <div className="mt-4 flex gap-3">
        <button onClick={onClose} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-gray-600">
          Keep it
        </button>
        <button
          onClick={submit}
          disabled={busy || reason.trim().length < 3}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
          Cancel
        </button>
      </div>
    </Modal>
  );
}

const OPEN_RETURN = ["REQUESTED", "APPROVED", "RECEIVED"];

function returnableUnits(subOrder: SubOrder, itemId: string, quantity: number, returned: number): number {
  const pending = subOrder.returns
    .filter((r) => OPEN_RETURN.includes(r.status))
    .flatMap((r) => r.items)
    .filter((i) => i.orderItemId === itemId)
    .reduce((a, i) => a + i.quantity, 0);
  return Math.max(quantity - returned - pending, 0);
}

function ReturnDialog({ subOrder, onClose, onDone }: { subOrder: SubOrder; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const lines = subOrder.items
    .map((i) => ({ item: i, max: returnableUnits(subOrder, i.id, i.quantity, i.returnedQuantity ?? 0) }))
    .filter((l) => l.max > 0);
  const chosen = Object.entries(qty).filter(([, q]) => q > 0);

  const submit = async () => {
    setBusy(true);
    try {
      await apiClient.post(`/sub-orders/${subOrder.id}/returns`, {
        items: chosen.map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
        reason: reason.trim(),
      });
      toast.success("Return requested. The seller will review it.");
      onDone();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not request the return"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Return items</h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        From {subOrder.vendor.businessName} · {subOrder.subOrderNumber}
      </p>
      <div className="mt-4 space-y-3">
        {lines.length === 0 && <p className="text-sm text-gray-500">Nothing left to return on this order.</p>}
        {lines.map(({ item, max }) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{item.variant.product.name}</p>
              <p className="text-xs text-gray-500">
                {item.variant.variantName ?? "Default"} · up to {max} unit{max > 1 ? "s" : ""}
              </p>
            </div>
            <select
              value={qty[item.id] ?? 0}
              onChange={(e) => setQty({ ...qty, [item.id]: Number(e.target.value) })}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
              aria-label={`Quantity to return for ${item.variant.product.name}`}
            >
              {Array.from({ length: max + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Why are you returning these? (required)"
        className="mt-4 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
      />
      <div className="mt-4 flex gap-3">
        <button onClick={onClose} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-gray-600">
          Close
        </button>
        <button
          onClick={submit}
          disabled={busy || chosen.length === 0 || reason.trim().length < 3}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          Request return
        </button>
      </div>
    </Modal>
  );
}

// ─── Returns + documents ─────────────────────────────────────────────────────

function DownloadButton({ path, filename, label }: { path: string; filename: string; label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          await downloadPdf(path, filename);
        } catch (err) {
          toast.error(apiErrorMessage(err, "Could not download the document"));
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700/50"
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
      {label}
    </button>
  );
}

function ReturnRow({ ret }: { ret: ReturnRecord }) {
  return (
    <div className="rounded-lg bg-orange-50/60 p-3 text-xs dark:bg-orange-900/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          Return · {ret.items.reduce((a, i) => a + i.quantity, 0)} unit(s)
        </span>
        <StatusPill status={ret.status} />
      </div>
      <p className="mt-1 text-gray-600 dark:text-gray-300">{ret.reason}</p>
      {ret.vendorNote && <p className="mt-1 text-gray-500">Seller: {ret.vendorNote}</p>}
      {(ret.status === "REFUNDED" || ret.status === "CREDITED") && ret.refundAmount != null && (
        <p className="mt-1 font-semibold text-teal-700 dark:text-teal-300">
          {formatRupees(ret.refundAmount)} {ret.status === "CREDITED" ? "credited to your khata" : "refunded"}
        </p>
      )}
      {ret.creditNote && (
        <div className="mt-2">
          <DownloadButton
            path={`/invoices/${ret.creditNote.id}/pdf`}
            filename={`credit-note-${ret.creditNote.invoiceNumber.replace(/\//g, "-")}.pdf`}
            label={`Credit note ${ret.creditNote.invoiceNumber}`}
          />
        </div>
      )}
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

const CANCELLABLE = ["PENDING", "CONFIRMED"];

export function SubOrdersSection({ order, onChanged }: { order: OrderDetail; onChanged: () => void }) {
  const [cancelFor, setCancelFor] = useState<SubOrder | null>(null);
  const [returnFor, setReturnFor] = useState<SubOrder | null>(null);
  const subOrders = order.subOrders ?? [];

  return (
    <div className="space-y-5">
      {subOrders.map((so) => {
        const taxTotal = Number(so.cgstAmount) + Number(so.sgstAmount) + Number(so.igstAmount);
        const taxInvoice = so.invoices.find((i) => i.type === "TAX_INVOICE");
        const canReturn =
          so.status === "DELIVERED" &&
          so.items.some((i) => returnableUnits(so, i.id, i.quantity, i.returnedQuantity ?? 0) > 0);
        return (
          <section
            key={so.id}
            className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-gray-950/30"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-700">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Sold by</p>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{so.vendor.businessName}</h3>
                <p className="font-mono text-[11px] text-gray-400">{so.subOrderNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  {so.isInterState ? "IGST · inter-state" : "CGST + SGST · same state"}
                </span>
                <StatusPill status={so.status} />
              </div>
            </header>

            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {so.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <Package size={18} className="text-gray-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.variant.product.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.variant.variantName ?? "Default"} · Qty {item.quantity} · {formatRupees(item.unitPrice)} each
                      {item.gstRate != null && ` · GST ${Number(item.gstRate)}%`}
                      {item.hsnCode ? ` · HSN ${item.hsnCode}` : ""}
                    </p>
                    {(item.returnedQuantity ?? 0) > 0 && (
                      <span className="mt-0.5 inline-block rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                        {item.returnedQuantity} returned
                      </span>
                    )}
                  </div>
                  <p className="shrink-0 text-sm font-bold text-gray-900 dark:text-gray-100">
                    {formatRupees(Number(item.unitPrice) * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            <dl className="space-y-1 border-t border-gray-100 px-5 py-3 text-xs dark:border-gray-700">
              {!isZero(so.discountAmount) && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Discount</dt>
                  <dd className="font-medium text-emerald-700 dark:text-emerald-400">−{formatRupees(so.discountAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Taxable value</dt>
                <dd>{formatRupees(so.taxableValue)}</dd>
              </div>
              {!isZero(so.cgstAmount) && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">CGST</dt>
                  <dd>{formatRupees(so.cgstAmount)}</dd>
                </div>
              )}
              {!isZero(so.sgstAmount) && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">SGST</dt>
                  <dd>{formatRupees(so.sgstAmount)}</dd>
                </div>
              )}
              {!isZero(so.igstAmount) && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">IGST</dt>
                  <dd>{formatRupees(so.igstAmount)}</dd>
                </div>
              )}
              {taxTotal === 0 && !isZero(so.gstAmount) && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">GST</dt>
                  <dd>{formatRupees(so.gstAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Delivery</dt>
                <dd>{isZero(so.deliveryCharge) ? "Free" : formatRupees(so.deliveryCharge)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-1.5 text-sm font-bold dark:border-gray-700">
                <dt className="text-gray-900 dark:text-gray-100">Total</dt>
                <dd className="text-gray-900 dark:text-gray-100">{formatRupees(so.totalAmount)}</dd>
              </div>
            </dl>

            {so.shipments.length > 0 && (
              <div className="space-y-2 border-t border-gray-100 px-5 py-4 dark:border-gray-700">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Tracking</p>
                {so.shipments.map((s) => (
                  <ShipmentCard key={s.id} shipment={s} />
                ))}
              </div>
            )}

            {so.status === "CANCELLED" && so.cancellationReason && (
              <p className="border-t border-red-100 bg-red-50 px-5 py-3 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                Cancelled: {so.cancellationReason}
              </p>
            )}

            {so.returns.length > 0 && (
              <div className="space-y-2 border-t border-gray-100 px-5 py-4 dark:border-gray-700">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Returns</p>
                {so.returns.map((r) => (
                  <ReturnRow key={r.id} ret={r} />
                ))}
              </div>
            )}

            <footer className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-700">
              {taxInvoice ? (
                <DownloadButton
                  path={`/sub-orders/${so.id}/invoice`}
                  filename={`invoice-${taxInvoice.invoiceNumber.replace(/\//g, "-")}.pdf`}
                  label={`Invoice ${taxInvoice.invoiceNumber}`}
                />
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  <FileText size={12} /> Invoice is issued when the seller ships
                </span>
              )}
              {CANCELLABLE.includes(so.status) && (
                <button
                  onClick={() => setCancelFor(so)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                >
                  <XCircle size={12} /> Cancel this part
                </button>
              )}
              {canReturn && (
                <button
                  onClick={() => setReturnFor(so)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/30"
                >
                  <RotateCcw size={12} /> Return items
                </button>
              )}
            </footer>
          </section>
        );
      })}

      {cancelFor && (
        <CancelDialog
          subOrder={cancelFor}
          onClose={() => setCancelFor(null)}
          onDone={() => {
            setCancelFor(null);
            onChanged();
          }}
        />
      )}
      {returnFor && (
        <ReturnDialog
          subOrder={returnFor}
          onClose={() => setReturnFor(null)}
          onDone={() => {
            setReturnFor(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
