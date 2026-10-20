"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { apiErrorMessage, runCheckout, verifyPayment, type GatewayDetails } from "@/lib/razorpay";
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, Loader2, Eye, EyeOff, X, ChevronLeft, ChevronRight, CreditCard, History, Download } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface WalletData {
  balance: number;
  walletId: string;
}

interface WalletTransaction {
  id: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  balanceAfter: number;
  remarks: string | null;
  referenceId: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── CSV Export ────────────────────────────────────────────────────────────────

function exportWalletCSV(transactions: WalletTransaction[]) {
  const headers = ["Date","Type","Amount","Balance After","Remarks","Reference ID"];
  const rows = transactions.map((tx) => [
    new Date(tx.createdAt).toISOString().split("T")[0],
    tx.type,
    tx.amount.toString(),
    tx.balanceAfter.toString(),
    tx.remarks ?? "",
    tx.referenceId ?? "",
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `wallet-transactions-${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast.success("Transactions exported as CSV");
}

// ─── Add Money Modal ─────────────────────────────────────────────────────────

function AddMoneyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const PRESET_AMOUNTS = [500, 1000, 2000, 5000];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!amount || numAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    if (numAmount > 100000) {
      setError("Maximum ₹1,00,000 per transaction");
      return;
    }
    setIsAdding(true);
    setError("");
    try {
      // 1. The server creates a gateway order. The wallet is NOT credited yet.
      const started = await apiClient.post<{
        success: boolean;
        data: { payment: { id: string }; gateway: GatewayDetails };
      }>("/wallet/add-money", { amount: numAmount });
      const { payment, gateway } = started.data.data;

      // 2. The customer pays in Razorpay Checkout.
      const outcome = await runCheckout(gateway, { description: "Wallet top-up" });
      if (outcome.status === "cancelled") {
        setError("Payment cancelled. No money was added.");
        return;
      }
      if (outcome.status === "failed") {
        setError(outcome.message);
        return;
      }

      // 3. The server verifies the signature and only then credits the wallet.
      await verifyPayment(payment.id, outcome.result);
      toast.success(`₹${numAmount.toLocaleString("en-IN")} added to wallet`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, "Failed to add money"));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
              <Plus size={20} className="text-emerald-700 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add Money</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-500">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Preset amounts */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Quick Select
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => { setAmount(String(preset)); setError(""); }}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-all ${
                    Number(amount) === preset
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}
                >
                  {formatCurrency(preset)}
                </button>
              ))}
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Amount *
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">₹</span>
              <input
                type="number"
                step="1"
                min="1"
                max="100000"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(""); }}
                placeholder="Enter amount"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-3 pl-8 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 px-4 py-3">
              <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isAdding || !amount}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 dark:bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow dark:shadow-gray-950/20 hover:bg-emerald-800 disabled:opacity-50 transition-all"
          >
            {isAdding ? (
              <><Loader2 size={16} className="animate-spin" /> Adding...</>
            ) : (
              <><Plus size={16} /> Add to Wallet</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Wallet Page ─────────────────────────────────────────────────────────────

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(0);
  const [txTotal, setTxTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [showAddMoney, setShowAddMoney] = useState(false);

  const loadWallet = useCallback(async () => {
    try {
      const res = await apiClient.get<{ success: boolean; data: WalletData }>("/wallet");
      setWallet(res.data.data);
    } catch {
      toast.error("Failed to load wallet");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async (page: number) => {
    setTxLoading(true);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: WalletTransaction[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/wallet/transactions", { params: { page, limit: 15 } });
      setTransactions(res.data.data);
      setTxTotal(res.data.pagination.total);
      setTxPage(res.data.pagination.page);
      setTxTotalPages(res.data.pagination.totalPages);
    } catch {
      // silently fail
    } finally {
      setTxLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadWallet();
    loadTransactions(1);
  }, [loadWallet, loadTransactions]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
      </div>
    );
  }

  const balance = wallet?.balance ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Wallet</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Manage your wallet balance and transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddMoney(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 dark:bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow dark:shadow-gray-950/20 hover:bg-emerald-800 transition-all"
          >
            <Plus size={16} />
            Add Money
          </button>
          {transactions.length > 0 && (
            <button
              onClick={() => exportWalletCSV(transactions)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all"
            >
              <Download size={16} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Balance Card */}
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500 p-6 text-white shadow-lg dark:shadow-gray-950/30">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-100 dark:text-emerald-200">Available Balance</p>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="rounded-lg p-1.5 text-emerald-100 dark:text-emerald-200 hover:bg-white/10 dark:hover:bg-gray-700/30 transition-colors"
          >
            {showBalance ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <p className="text-3xl font-bold tracking-tight">
          {showBalance ? formatCurrency(balance) : "••••••"}
        </p>
        <div className="mt-4 flex items-center gap-4 text-xs text-emerald-100 dark:text-emerald-200">
          <span className="flex items-center gap-1">
            <CreditCard size={12} />
            Wallet ID: {wallet?.walletId.slice(0, 8)}...
          </span>
          <span className="flex items-center gap-1">
            <History size={12} />
            {txTotal} transactions
          </span>
        </div>
      </div>

      {/* Transactions */}
      <div>
        <h2 className="mb-4 text-sm font-bold text-gray-900 dark:text-gray-100">Transaction History</h2>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30">
          {txLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin text-emerald-700 dark:text-emerald-400" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-700/50">
                <Wallet size={24} className="text-gray-300 dark:text-gray-500" />
              </div>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">No transactions yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Add money to your wallet to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-start justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      tx.type === "CREDIT" ? "bg-emerald-50 dark:bg-emerald-900/30" : "bg-red-50 dark:bg-red-900/30"
                    }`}>
                      {tx.type === "CREDIT" ? (
                        <ArrowDownLeft size={16} className="text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <ArrowUpRight size={16} className="text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {tx.remarks ?? (tx.type === "CREDIT" ? "Money Added" : "Payment")}
                      </p>
                      {tx.referenceId && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">Ref: {tx.referenceId.slice(0, 12)}</p>
                      )}
                      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{formatDateTime(tx.createdAt)}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-bold ${tx.type === "CREDIT" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {tx.type === "CREDIT" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">Bal: {formatCurrency(tx.balanceAfter)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>          {txTotalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Page {txPage} of {txTotalPages}</p>
              <div className="flex gap-1">
                <button
                  onClick={() => loadTransactions(txPage - 1)}
                  disabled={txPage <= 1}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 p-1.5 text-gray-600 dark:text-gray-300 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => loadTransactions(txPage + 1)}
                  disabled={txPage >= txTotalPages}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 p-1.5 text-gray-600 dark:text-gray-300 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
      </div>

      {showAddMoney && (
        <AddMoneyModal
          onClose={() => setShowAddMoney(false)}
          onSuccess={() => {
            loadWallet();
            loadTransactions(1);
          }}
        />
      )}
    </div>
  );
}
