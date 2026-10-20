"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Download, Loader2, PackageCheck, RotateCcw, Wallet, X } from "lucide-react";
import apiClient from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/razorpay";
import { downloadPdf } from "@/lib/download";
import { formatRupees } from "@/lib/money";
import { StatusPill } from "@/components/orders/SubOrdersSection";
import type { ReturnRecord, ReturnStatus } from "@/types/auth";

/**
 * Return requests for this seller's sub-orders:
 *   requested -> approve -> goods received (optionally restocked) -> refund / credit (issues the credit note).
 * The refund goes back where the money came from: the payment gateway, the customer's wallet, or a reversing khata entry.
 */

const FILTERS: { value: ReturnStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "REQUESTED", label: "To review" },
  { value: "APPROVED", label: "Awaiting goods" },
  { value: "RECEIVED", label: "To refund" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "CREDITED", label: "Khata credited" },
  { value: "REJECTED", label: "Rejected" },
];

function ReturnCard({ ret, onChanged }: { ret: ReturnRecord; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [restock, setRestock] = useState(true);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      setRejecting(false);
      setNote("");
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err, "That did not work"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{ret.subOrder?.subOrderNumber ?? "Sub-order"}</p>
          <p className="text-xs text-gray-500">{new Date(ret.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>
        <StatusPill status={ret.status} />
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {ret.items.map((i) => (
          <li key={i.id} className="flex justify-between">
            <span className="text-gray-700 dark:text-gray-200">{i.orderItem?.variant.product.name ?? "Item"} <span className="text-gray-400">({i.orderItem?.variant.variantName ?? "Default"})</span></span>
            <span className="font-medium">× {i.quantity}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-700/40 dark:text-gray-300">“{ret.reason}”</p>
      {ret.vendorNote && <p className="mt-2 text-xs text-gray-500">Your note: {ret.vendorNote}</p>}
      {ret.refundAmount != null && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-teal-700 dark:text-teal-300">
          <Wallet size={14} /> {formatRupees(ret.refundAmount)} {ret.status === "CREDITED" ? "credited against the khata" : "refunded"}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {ret.status === "REQUESTED" && !rejecting && (
          <>
            <button disabled={busy} onClick={() => run("Return approved", () => apiClient.put(`/returns/${ret.id}/approve`, {}))} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60">
              <Check size={12} /> Approve
            </button>
            <button disabled={busy} onClick={() => setRejecting(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3.5 py-2 text-xs font-semibold text-red-700 dark:border-red-800 dark:text-red-400">
              <X size={12} /> Reject
            </button>
          </>
        )}
        {rejecting && (
          <div className="flex w-full flex-wrap items-center gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why is it rejected? (shown to the customer)" className="min-w-[14rem] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs dark:border-gray-600 dark:bg-gray-900" />
            <button disabled={busy || note.trim().length < 3} onClick={() => run("Return rejected", () => apiClient.put(`/returns/${ret.id}/reject`, { note: note.trim() }))} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Reject</button>
            <button onClick={() => setRejecting(false)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold dark:border-gray-600">Back</button>
          </div>
        )}
        {ret.status === "APPROVED" && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} /> Put back on sale
            </label>
            <button disabled={busy} onClick={() => run("Marked as received", () => apiClient.put(`/returns/${ret.id}/receive`, { restock }))} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60">
              <PackageCheck size={12} /> Goods received
            </button>
          </>
        )}
        {ret.status === "RECEIVED" && (
          <button disabled={busy} onClick={() => run("Refund issued and credit note created", () => apiClient.post(`/returns/${ret.id}/resolve`))} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Refund &amp; issue credit note
          </button>
        )}
        {ret.creditNote && (
          <button
            onClick={() => downloadPdf(`/invoices/${ret.creditNote!.id}/pdf`, `credit-note-${ret.creditNote!.invoiceNumber.replace(/\//g, "-")}.pdf`).catch(() => toast.error("Could not download"))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold dark:border-gray-600"
          >
            <Download size={12} /> {ret.creditNote.invoiceNumber}
          </button>
        )}
      </div>
    </div>
  );
}

export default function VendorReturnsPage() {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [status, setStatus] = useState<ReturnStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { page: 1, limit: 50 };
      if (status) params.status = status;
      const res = await apiClient.get<{ success: boolean; data: ReturnRecord[] }>("/returns", { params });
      setReturns(res.data.data);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load returns"));
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Returns</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Review, receive and refund returns on your sub-orders.</p>
        </div>
        <Link href="/dashboard/vendor/orders" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-gray-600">Orders</Link>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.value || "all"} onClick={() => setStatus(f.value)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${status === f.value ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"}`}>
            {f.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-emerald-700" /></div>
      ) : returns.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500">No returns here.</p>
      ) : (
        <div className="space-y-4">
          {returns.map((r) => (
            <ReturnCard key={r.id} ret={r} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}
