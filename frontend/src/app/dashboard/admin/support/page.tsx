"use client";

import { useEffect, useState, useCallback } from "react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import {
  Headphones,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  MessageSquare,
  User,
  Shield,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TicketUser {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: string;
}

interface TicketMessage {
  id: string;
  message: string;
  senderName: string;
  isInternal: boolean;
  createdAt: string;
}

interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  user?: TicketUser;
  assignedTo?: string;
  messages?: TicketMessage[];
  messageCount?: number;
  createdAt: string;
}

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  OPEN: { bg: "bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", icon: AlertCircle },
  IN_PROGRESS: { bg: "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", icon: Clock },
  WAITING_FOR_USER: { bg: "bg-purple-50 dark:bg-purple-900/30 dark:bg-purple-900/30", text: "text-purple-800", icon: Clock },
  RESOLVED: { bg: "bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300", icon: CheckCircle2 },
  CLOSED: { bg: "bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50", text: "text-gray-600 dark:text-gray-300 dark:text-gray-300", icon: CheckCircle2 },
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-700 dark:text-gray-200 dark:text-gray-200",
  MEDIUM: "bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  HIGH: "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300",
  CRITICAL: "bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30 text-red-800",
};

const CATEGORY_LABELS: Record<string, string> = {
  ORDER: "Order",
  PAYMENT: "Payment",
  KHATA: "Khata",
  PRODUCT: "Product",
  OTHER: "Other",
};

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
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
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[priority] ?? "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 text-gray-700 dark:text-gray-200 dark:text-gray-200"}`}>
      {priority}
    </span>
  );
}

// ─── Ticket Detail Drawer ────────────────────────────────────────────────────

function TicketDetailDrawer({ ticketId, onClose, onRefresh }: { ticketId: string; onClose: () => void; onRefresh: () => void }) {
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const loadTicket = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: SupportTicket & { messages: TicketMessage[] } }>(`/support/tickets/${ticketId}`);
      setTicket(res.data.data);
      setMessages(res.data.data.messages ?? []);
    } catch {
      toast.error("Failed to load ticket");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadTicket(); }, [loadTicket]);

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      await apiClient.post(`/support/tickets/${ticketId}/messages`, { message: replyText.trim() });
      setReplyText("");
      await loadTicket();
      onRefresh();
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    try {
      await apiClient.put(`/support/tickets/${ticketId}`, { status, remarks: `Status changed to ${status} by admin` });
      toast.success(`Ticket ${status.toLowerCase()}`);
      await loadTicket();
      onRefresh();
    } catch {
      toast.error(`Failed to update ticket`);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-end">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative flex h-full w-full max-w-lg flex-col bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/50">
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" /></div>
        </div>
      </div>
    );
  }

  if (!ticket) return null;

  const isClosed = ticket.status === "CLOSED" || ticket.status === "RESOLVED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 dark:border-gray-700 px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{ticket.title}</h2>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              {ticket.category && <span className="rounded-full bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300 dark:text-gray-300">{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>}
              {ticket.user && (
                <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  <User size={10} /> {ticket.user.fullName}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Original description */}
          <div className="mb-4 rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wider">Description</p>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-200 dark:text-gray-200">{ticket.description}</p>
            <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Created {formatDateTime(ticket.createdAt)}</p>
          </div>

          {/* Messages */}
          {messages.length > 0 ? (
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
          ) : (
            <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 italic">No messages yet</p>
          )}
        </div>

        {/* Actions & Reply */}
        <div className="border-t border-gray-200 dark:border-gray-700 dark:border-gray-700 px-6 py-4 space-y-3">
          {!isClosed && (
            <div className="flex gap-2">
              <button onClick={() => handleUpdateStatus("IN_PROGRESS")} disabled={ticket.status === "IN_PROGRESS"}
                className="flex-1 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 disabled:opacity-40 transition-colors">
                In Progress
              </button>
              <button onClick={() => handleUpdateStatus("RESOLVED")}
                className="flex-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors">
                Resolve
              </button>
              <button onClick={() => handleUpdateStatus("CLOSED")}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700 transition-colors">
                Close
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
              placeholder={isClosed ? "Ticket is closed" : "Type your reply..."}
              disabled={isClosed || sendingReply}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20 disabled:bg-gray-50 dark:bg-gray-700/50 disabled:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
            <button onClick={handleSendReply} disabled={!replyText.trim() || isClosed || sendingReply}
              className="flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors">
              {sendingReply ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [detailTicketId, setDetailTicketId] = useState<string | null>(null);

  const loadTickets = useCallback(async (p: number, status: string) => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, limit: 20 };
      if (status) params.status = status;
      const res = await apiClient.get<{ success: boolean; data: SupportTicket[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>("/support/tickets/all", { params });
      setTickets(res.data.data);
      setTotal(res.data.pagination.total);
      setPage(res.data.pagination.page);
      setTotalPages(res.data.pagination.totalPages);
    } catch {
      toast.error("Failed to load tickets");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadTickets(page, statusFilter); }, [page, statusFilter, loadTickets]);

  const handlePageChange = (p: number) => { if (p >= 1 && p <= totalPages) setPage(p); };

  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
            <Headphones size={24} className="text-emerald-700 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Support Tickets</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Manage all user support tickets</p>
          </div>
        </div>

        {/* Status Filter */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {STATUS_TABS.map((tab) => (
            <button key={tab.value} onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === tab.value ? "bg-emerald-700 text-white shadow-sm dark:shadow-gray-950/30" : "bg-white dark:bg-gray-800 dark:bg-gray-800 text-gray-600 dark:text-gray-300 dark:text-gray-300 border border-gray-200 dark:border-gray-700 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 dark:border-gray-600"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" /></div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50"><Headphones size={28} className="text-gray-300" /></div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">No tickets found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{statusFilter ? "No tickets match this status" : "No support tickets have been created yet"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{total} ticket{total !== 1 ? "s" : ""}</p>
            {tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 truncate">{ticket.title}</h3>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 line-clamp-2">{ticket.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={ticket.priority} />
                      {ticket.category && <span className="rounded-full bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300 dark:text-gray-300">{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>}
                      {ticket.user && (
                        <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                          <User size={10} /> {ticket.user.fullName}
                          <span className="text-gray-300">·</span>
                          <Shield size={10} /> {ticket.user.role}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatDate(ticket.createdAt)}</span>
                      {ticket.messageCount !== undefined && ticket.messageCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                          <MessageSquare size={10} /> {ticket.messageCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setDetailTicketId(ticket.id)}
                    className="shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 p-2 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">
                    <Eye size={15} />
                  </button>
                </div>
              </div>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"><ChevronLeft size={16} /></button>
                <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Page {page} of {totalPages}</span>
                <button onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            )}
          </div>
        )}
      </div>

      {detailTicketId && (
        <TicketDetailDrawer ticketId={detailTicketId} onClose={() => setDetailTicketId(null)}
          onRefresh={() => loadTickets(page, statusFilter)} />
      )}
    </RoleGuard>
  );
}
