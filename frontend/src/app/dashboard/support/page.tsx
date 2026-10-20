"use client";

import { useEffect, useState, useCallback } from "react";
import { useTicketStore } from "@/stores/ticketStore";
import { toast } from "sonner";
import { LifeBuoy, Loader2, Plus, X, ChevronLeft, ChevronRight, Send, Clock, CheckCircle2, AlertCircle, Eye, MessageSquare } from "lucide-react";
import type { SupportTicket, TicketMessage } from "@/types/auth";

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  OPEN: { bg: "bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", icon: AlertCircle },
  IN_PROGRESS: { bg: "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", icon: Clock },
  WAITING_FOR_USER: { bg: "bg-purple-50 dark:bg-purple-900/30 dark:bg-purple-900/30", text: "text-purple-800", icon: Clock },
  RESOLVED: { bg: "bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300", icon: CheckCircle2 },
  CLOSED: { bg: "bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50", text: "text-gray-600 dark:text-gray-300 dark:text-gray-300", icon: CheckCircle2 },
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  LOW: { bg: "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700", text: "text-gray-700 dark:text-gray-200 dark:text-gray-200" },
  MEDIUM: { bg: "bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300" },
  HIGH: { bg: "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300" },
  CRITICAL: { bg: "bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30", text: "text-red-800" },
};

const CATEGORY_LABELS: Record<string, string> = {
  ORDER: "Order",
  PAYMENT: "Payment",
  KHATA: "Khata",
  PRODUCT: "Product",
  OTHER: "Other",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { bg: "bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50", text: "text-gray-600 dark:text-gray-300 dark:text-gray-300", icon: Clock };
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.bg} ${style.text}`}>
      <Icon size={11} />
      {status === "WAITING_FOR_USER" ? "Waiting" : status.charAt(0) + status.slice(1).toLowerCase().replace("_", " ")}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const style = PRIORITY_STYLES[priority] ?? { bg: "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700", text: "text-gray-700 dark:text-gray-200 dark:text-gray-200" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>
      {priority}
    </span>
  );
}

// ─── Status Filter Tabs ──────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

// ─── Ticket Card ─────────────────────────────────────────────────────────────

function TicketCard({
  ticket,
  onViewDetail,
}: {
  ticket: SupportTicket;
  onViewDetail: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 line-clamp-1">{ticket.title}</h3>
            <StatusBadge status={ticket.status} />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 line-clamp-2">{ticket.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PriorityBadge priority={ticket.priority} />
            {ticket.category && (
              <span className="rounded-full bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300 dark:text-gray-300">
                {CATEGORY_LABELS[ticket.category] ?? ticket.category}
              </span>
            )}
            <span className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatDate(ticket.createdAt)}</span>
            {ticket.messageCount !== undefined && ticket.messageCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                <MessageSquare size={10} />
                {ticket.messageCount}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onViewDetail}
          className="shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 p-2 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-colors hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400"
          title="View details"
        >
          <Eye size={15} />
        </button>
      </div>
    </div>
  );
}

// ─── Ticket Detail Drawer ────────────────────────────────────────────────────

function TicketDetailDrawer({
  ticketId,
  onClose,
}: {
  ticketId: string;
  onClose: () => void;
}) {
  const { selectedTicket, isTicketLoading, fetchTicketById, addMessage, updateTicketStatus } = useTicketStore();
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
     
    fetchTicketById(ticketId).finally(() => setLoading(false));
     
  }, [ticketId, fetchTicketById]);

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      await addMessage(ticketId, replyText.trim());
      setReplyText("");
      toast.success("Reply sent");
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  const handleResolve = async () => {
    try {
      await updateTicketStatus(ticketId, "RESOLVED");
      toast.success("Ticket marked as resolved");
    } catch {
      toast.error("Failed to update ticket");
    }
  };

  const handleClose = async () => {
    try {
      await updateTicketStatus(ticketId, "CLOSED");
      toast.success("Ticket closed");
    } catch {
      toast.error("Failed to close ticket");
    }
  };

  const isClosed = selectedTicket?.status === "CLOSED" || selectedTicket?.status === "RESOLVED";

  if (loading || isTicketLoading || !selectedTicket) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-end">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative flex h-full w-full max-w-lg flex-col bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/50">
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
          </div>
        </div>
      </div>
    );
  }

  const t = selectedTicket;
  const messages: TicketMessage[] = (t as unknown as { messages?: TicketMessage[] }).messages ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 dark:border-gray-700 px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{t.title}</h2>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={t.status} />
              <PriorityBadge priority={t.priority} />
              {t.category && (
                <span className="rounded-full bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300 dark:text-gray-300">
                  {CATEGORY_LABELS[t.category] ?? t.category}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!isClosed && (
              <>
                <button
                  onClick={handleResolve}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30"
                >
                  Resolve
                </button>
                <button
                  onClick={handleClose}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"
                >
                  Close
                </button>
              </>
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Original description */}
          <div className="mb-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Description</p>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-200 dark:text-gray-200">{t.description}</p>
            <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Created {formatDateTime(t.createdAt)}</p>
          </div>

          {/* Messages */}
          {messages.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Messages ({messages.length})</p>
              {messages.map((msg) => (
                <div key={msg.id} className={`rounded-lg p-3 ${msg.isInternal ? "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800" : "bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50"}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{msg.senderName}</p>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatDateTime(msg.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-200 dark:text-gray-200">{msg.message}</p>
                  {msg.isInternal && <p className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">Internal note</p>}
                </div>
              ))}
            </div>
          )}

          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">No messages yet</p>
          )}
        </div>

        {/* Reply Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 dark:border-gray-700 px-6 py-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
              placeholder={isClosed ? "This ticket is closed" : "Type your reply..."}
              disabled={isClosed || sendingReply}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:bg-gray-50 dark:bg-gray-700/50 disabled:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500"
            />
            <button
              onClick={handleSendReply}
              disabled={!replyText.trim() || isClosed || sendingReply}
              className="flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-white transition-all hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendingReply ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Create Ticket Modal ─────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "", label: "Select category..." },
  { value: "ORDER", label: "Order Issue" },
  { value: "PAYMENT", label: "Payment Issue" },
  { value: "KHATA", label: "Khata Issue" },
  { value: "PRODUCT", label: "Product Issue" },
  { value: "OTHER", label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

function CreateTicketModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const { createTicket, isCreatingTicket } = useTicketStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    try {
      await createTicket({
        title: title.trim(),
        description: description.trim(),
        category: category || undefined,
        priority,
      });
      toast.success("Support ticket created");
      onClose();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to create ticket");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/50">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 dark:border-gray-700 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Create Support Ticket</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of your issue"
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your issue in detail..."
              rows={4}
              required
              className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 dark:text-gray-100 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-200 dark:text-gray-200 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-200 dark:text-gray-200 outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !description.trim() || isCreatingTicket}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreatingTicket ? <Loader2 size={16} className="animate-spin" /> : <LifeBuoy size={16} />}
              {isCreatingTicket ? "Creating..." : "Submit Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30">
        <LifeBuoy size={36} className="text-emerald-300" />
      </div>
      <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">No support tickets</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Create a ticket if you need help</p>
      <button
        onClick={onCreate}
        className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-800"
      >
        <Plus size={16} />
        Create Ticket
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const { tickets, total, page, totalPages, isLoading, fetchTickets } = useTicketStore();

  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailTicketId, setDetailTicketId] = useState<string | null>(null);

  const loadTickets = useCallback(
    (p: number, status: string) => {
      fetchTickets(p, 20, status ? { status } : undefined).catch(
        () => toast.error("Failed to load tickets"),
      );
    },
    [fetchTickets],
  );

  useEffect(() => {
     
    loadTickets(currentPage, statusFilter);
     
  }, [currentPage, statusFilter, loadTickets]);

  const handlePageChange = (p: number) => {
    if (p < 1) return;
    setCurrentPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPagesNum = Math.ceil(total / 20);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Support Tickets</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Get help with orders, payments, and more</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-800"
        >
          <Plus size={16} />
          New Ticket
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setCurrentPage(1);
            }}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === tab.value
                ? "bg-emerald-700 text-white shadow-sm dark:shadow-gray-950/30"
                : "bg-white dark:bg-gray-800 dark:bg-gray-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 border border-gray-200 dark:border-gray-700 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 dark:border-gray-600 hover:text-gray-800 dark:text-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState onCreate={() => setShowCreateModal(true)} />
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{total} ticket{total !== 1 ? "s" : ""}</p>
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onViewDetail={() => setDetailTicketId(ticket.id)}
              />
            ))}
          </div>

          {totalPagesNum > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(totalPagesNum, 5) }, (_, i) => {
                const start = Math.max(1, Math.min(currentPage - 2, totalPagesNum - 4));
                const p = start + i;
                if (p > totalPagesNum) return null;
                return (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                      p === currentPage ? "bg-emerald-700 text-white" : "text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPagesNum}
                className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Create Ticket Modal */}
      {showCreateModal && <CreateTicketModal onClose={() => setShowCreateModal(false)} />}

      {/* Detail Drawer */}
      {detailTicketId && (
        <TicketDetailDrawer
          ticketId={detailTicketId}
          onClose={() => setDetailTicketId(null)}
        />
      )}
    </div>
  );
}
