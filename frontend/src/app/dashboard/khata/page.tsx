"use client";

import { useEffect, useState, useCallback } from "react";
import { useKhataStore } from "@/stores/khataStore";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import { BookOpen, Loader2, ArrowUpRight, ArrowDownLeft, AlertCircle, CheckCircle2, Clock, Ban, Eye, X, ChevronLeft, ChevronRight, AlertTriangle, Percent, CalendarDays, Plus, Search, UserPlus, User } from "lucide-react";

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  ACTIVE: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300 dark:text-emerald-400", icon: CheckCircle2 },
  SETTLED: { bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", icon: CheckCircle2 },
  OVERDUE: { bg: "bg-red-50 dark:bg-red-900/30", text: "text-red-800 dark:text-red-300 dark:text-red-400", icon: AlertTriangle },
  SUSPENDED: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", icon: Ban },
  WRITTEN_OFF: { bg: "bg-gray-50 dark:bg-gray-700/50", text: "text-gray-800 dark:text-gray-200", icon: Ban },
};

const TXN_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  UDHAR_DIYA: { label: "Credit Given", color: "text-red-600 dark:text-red-400" },
  WAPSI_MILI: { label: "Repayment", color: "text-emerald-600 dark:text-emerald-400" },
  INTEREST_LAGA: { label: "Interest", color: "text-amber-600 dark:text-amber-400" },
  WAIVER: { label: "Waiver", color: "text-blue-600 dark:text-blue-400" },
  ORDER_LINKED: { label: "Order", color: "text-purple-600" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Account Card ────────────────────────────────────────────────────────────

function AccountCard({
  account,
  onViewDetail,
}: {
  account: import("@/types/auth").KhataAccount;
  onViewDetail: () => void;
}) {
  const style = STATUS_STYLES[account.status];
  const Icon = style?.icon ?? Clock;
  const isFarmer = account.farmer?.user.fullName;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              style?.bg ?? "bg-gray-50 dark:bg-gray-700/50"
            }`}
          >
            <Icon size={20} className={style?.text ?? "text-gray-500 dark:text-gray-400 dark:text-gray-500"} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {isFarmer || account.vendor?.businessName}
            </p>
            {account.farmer && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{account.farmer.user.phoneNumber}</p>
            )}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style?.bg} ${style?.text}`}
        >
          <Icon size={11} />
          {account.status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">Outstanding</p>
          <p className="mt-0.5 text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(account.outstandingAmount)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">Limit</p>
          <p className="mt-0.5 text-sm font-medium text-gray-700 dark:text-gray-200">{formatCurrency(account.creditLimitAmount)}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">Interest</p>
          <p className="mt-0.5 text-sm font-medium text-gray-700 dark:text-gray-200">{account.interestRatePct}%</p>
        </div>
      </div>

      {account.dueDateNextPayment && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <CalendarDays size={12} />
          Due: {formatDate(account.dueDateNextPayment)}
        </div>
      )}

      <button
        onClick={onViewDetail}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-400"
      >
        <Eye size={13} />
        View Transactions
      </button>
    </div>
  );
}

// ─── Transaction List ─────────────────────────────────────────────────────────

function TransactionList({ transactions }: { transactions: import("@/types/auth").KhataTransaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">No transactions yet</div>
    );
  }

  return (
    <div className="space-y-0">
      {transactions.map((tx) => {
        const txnInfo = TXN_TYPE_LABELS[tx.type] ?? { label: tx.type, color: "text-gray-600 dark:text-gray-300 dark:text-gray-500" };
        const isDebit = ["UDHAR_DIYA", "INTEREST_LAGA", "ORDER_LINKED"].includes(tx.type);

        return (
          <div key={tx.id} className="flex items-start justify-between border-b border-gray-50 px-4 py-3 last:border-0">
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  isDebit ? "bg-red-50 dark:bg-red-900/30" : "bg-emerald-50 dark:bg-emerald-900/30"
                }`}
              >
                {isDebit ? (
                  <ArrowUpRight size={14} className="text-red-600 dark:text-red-400" />
                ) : (
                  <ArrowDownLeft size={14} className="text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${txnInfo.color}`}>{txnInfo.label}</p>
                {tx.remarks && <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{tx.remarks}</p>}
                <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{formatDateTime(tx.createdAt)}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-sm font-bold ${isDebit ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {isDebit ? "+" : "-"}{formatCurrency(tx.amount)}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">Bal: {formatCurrency(tx.balanceAfter)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Detail Drawer ───────────────────────────────────────────────────────────

function AccountDetailDrawer({
  accountId,
  onClose,
}: {
  accountId: string;
  onClose: () => void;
}) {
  const { selectedAccount, isAccountLoading, transactions, transactionsLoading, getAccountById, getTransactions } =
    useKhataStore();
  const [loading, setLoading] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLoading(true);
    Promise.all([getAccountById(accountId), getTransactions(accountId)]).finally(() =>
      setLoading(false),
    );
  }, [accountId, getAccountById, getTransactions]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (loading || isAccountLoading || !selectedAccount) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-end">
        <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative flex h-full w-full max-w-lg flex-col bg-white dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/50">
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
          </div>
        </div>
      </div>
    );
  }

  const acct = selectedAccount;
  const style = STATUS_STYLES[acct.status];
  const StatusIcon = style?.icon ?? Clock;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {acct.vendor?.businessName || acct.farmer?.user.fullName || "Khata Account"}
            </h2>
            <span
              className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style?.bg} ${style?.text}`}
            >
              <StatusIcon size={11} />
              {acct.status}
            </span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-500">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Balance Card */}
          <div className="mx-6 mt-6 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 p-5 text-white">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-100 dark:text-emerald-200">Outstanding Balance</p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(acct.outstandingAmount)}</p>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-emerald-100 dark:text-emerald-200">Credit Limit</p>
                <p className="text-sm font-semibold">{formatCurrency(acct.creditLimitAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-emerald-100 dark:text-emerald-200">Interest</p>
                <p className="text-sm font-semibold">{acct.interestRatePct}%</p>
              </div>
              <div>
                <p className="text-[10px] text-emerald-100 dark:text-emerald-200">Period</p>
                <p className="text-sm font-semibold">{acct.creditPeriodDays}d</p>
              </div>
            </div>
            {acct.dueDateNextPayment && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-100 dark:text-emerald-200">
                <CalendarDays size={12} />
                Due: {formatDate(acct.dueDateNextPayment)}
              </div>
            )}
            <div className="mt-2 flex items-center gap-1 text-xs text-emerald-100 dark:text-emerald-200">
              <Percent size={10} />
              Available: {formatCurrency(Math.max(0, acct.creditLimitAmount - acct.outstandingAmount))}
            </div>
          </div>

          {/* Transactions */}
          <div className="mx-6 mt-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Transactions ({transactions.length})
            </h3>
            <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
              {transactionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="animate-spin text-emerald-700 dark:text-emerald-400" />
                </div>
              ) : (
                <TransactionList transactions={transactions} />
              )}
            </div>
          </div>

          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}

// ─── Create Khata Account Drawer ──────────────────────────────────────────────

function CreateKhataAccountDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { createAccount, searchFarmers } = useKhataStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; fullName: string; phoneNumber: string; farmerProfile?: { id: string } | null }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState<{
    id: string;
    fullName: string;
    phoneNumber: string;
    farmerProfile?: { id: string } | null;
  } | null>(null);

  // Form fields
  const [creditLimit, setCreditLimit] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [creditPeriod, setCreditPeriod] = useState("30");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Debounced search
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchFarmers(searchQuery.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, searchFarmers]);

  const handleSelectFarmer = (farmer: {
    id: string;
    fullName: string;
    phoneNumber: string;
    farmerProfile?: { id: string } | null;
  }) => {
    setSelectedFarmer(farmer);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!selectedFarmer) {
      setFormError("Please select a farmer");
      return;
    }
    if (!creditLimit || Number(creditLimit) <= 0) {
      setFormError("Credit limit must be positive");
      return;
    }

    setIsSaving(true);
    try {
      await createAccount({
        farmerId: selectedFarmer.farmerProfile?.id ?? selectedFarmer.id,
        creditLimitAmount: Number(creditLimit),
        interestRatePct: interestRate ? Number(interestRate) : undefined,
        creditPeriodDays: creditPeriod ? Number(creditPeriod) : undefined,
      });
      toast.success(`Khata account created for ${selectedFarmer.fullName}`);
      onCreated();
      onClose();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setFormError(axiosError.response?.data?.message ?? "Failed to create account");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
              <UserPlus size={20} className="text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Create Khata Account</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Set up credit account with a farmer</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-500">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleCreate} className="flex-1 overflow-y-auto px-6 py-6">
          {/* Step 1: Farmer Search */}
          <div className="mb-6">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Select Farmer *
            </label>
            {selectedFarmer ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                    <User size={16} className="text-emerald-700 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedFarmer.fullName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{selectedFarmer.phoneNumber}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFarmer(null)}
                  className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-500"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or phone number..."
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 pl-9 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
                />
              </div>
            )}

            {/* Search results */}
            {searchResults.length > 0 && !selectedFarmer && (
              <div className="mt-2 max-h-48 divide-y divide-gray-100 dark:divide-gray-700 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30">
                {searchResults.map((farmer) => (
                  <button
                    key={farmer.id}
                    type="button"
                    onClick={() => handleSelectFarmer(farmer)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                      <User size={14} className="text-gray-500 dark:text-gray-400 dark:text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{farmer.fullName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{farmer.phoneNumber}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searching && !selectedFarmer && (
              <div className="mt-2 flex items-center gap-2 px-2 py-2">
                <Loader2 size={14} className="animate-spin text-emerald-700 dark:text-emerald-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Searching...</span>
              </div>
            )}

            {searchQuery.length >= 3 && searchResults.length === 0 && !searching && !selectedFarmer && (
              <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">No farmers found. Try a different search term.</p>
            )}
          </div>

          {/* Step 2: Account Terms */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">Account Terms</p>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Credit Limit (₹) *
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">₹</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={creditLimit}
                  onChange={(e) => { setCreditLimit(e.target.value); setFormError(""); }}
                  placeholder="e.g. 50000"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 pl-8 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Interest Rate (%)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">%</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 pr-8 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Credit Period (Days)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="365"
                  value={creditPeriod}
                  onChange={(e) => setCreditPeriod(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
                />
              </div>
            </div>
          </div>

          {/* Form error */}
          {formError && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 px-4 py-3">
              <AlertCircle size={14} className="text-red-500 dark:text-red-400 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400">{formError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedFarmer || !creditLimit || isSaving}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 dark:bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow dark:shadow-gray-950/20 hover:bg-emerald-800 disabled:opacity-50 transition-all"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {isSaving ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30">
        <BookOpen size={36} className="text-emerald-300 dark:text-emerald-400" />
      </div>
      <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100">No khata accounts</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Khata accounts will appear here once created</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KhataPage() {
  const { accounts, total, isLoading, getAccounts } = useKhataStore();
  const { user } = useAuthStore();
  const [detailAccountId, setDetailAccountId] = useState<string | null>(null);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const loadAccounts = useCallback(
    (page: number) => {
      getAccounts(page, 20).catch(() => toast.error("Failed to load khata accounts"));
    },
    [getAccounts],
  );

   
  useEffect(() => {
    loadAccounts(currentPage);
  }, [currentPage, loadAccounts]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handlePageChange = (p: number) => {
    if (p < 1) return;
    setCurrentPage(p);
  };

  const isFarmer = user?.role === "FARMER";
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">KhataBook</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {isFarmer ? "Your credit accounts with vendors" : "Farmer credit accounts"}
          </p>
        </div>
        {!isFarmer && (
          <button
            onClick={() => setShowCreateAccount(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 dark:bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow dark:shadow-gray-950/20 hover:bg-emerald-800 transition-all"
          >
            <Plus size={16} />
            Create Account
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onViewDetail={() => setDetailAccountId(account.id)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="rounded-lg border border-gray-300 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-500 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="rounded-lg border border-gray-300 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-500 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {detailAccountId && (
        <AccountDetailDrawer
          accountId={detailAccountId}
          onClose={() => setDetailAccountId(null)}
        />
      )}

      {showCreateAccount && (
        <CreateKhataAccountDrawer
          onClose={() => setShowCreateAccount(false)}
          onCreated={() => loadAccounts(currentPage)}
        />
      )}
    </div>
  );
}
