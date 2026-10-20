"use client";

import { useEffect, useState, useCallback } from "react";
import { useNotificationStore } from "@/stores/notificationStore";
import { toast } from "sonner";
import { Bell, Loader2, CheckCheck, Trash2, ChevronLeft, ChevronRight, Package, BookOpen, Percent, CheckCircle2, Info, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { NotificationType } from "@/types/auth";

// ─── Type config ─────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string }> = {
  ORDER_UPDATE: { icon: Package, color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30" },
  KHATA_REMINDER: { icon: BookOpen, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30" },
  OFFER: { icon: Percent, color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/30 dark:bg-purple-900/30" },
  SYSTEM: { icon: Info, color: "text-gray-700 dark:text-gray-200 dark:text-gray-200", bg: "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700" },
};

const TYPE_LABELS: Record<string, string> = {
  ORDER_UPDATE: "Order Update",
  KHATA_REMINDER: "Khata Reminder",
  OFFER: "Offer",
  SYSTEM: "System",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Notification Card ───────────────────────────────────────────────────────

function NotificationCard({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: import("@/types/auth").NotificationItem;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const config = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.SYSTEM;
  const Icon = config.icon;

  return (
    <div
      className={`rounded-xl border p-4 transition-all hover:shadow-sm dark:shadow-gray-950/30 ${
        notification.isRead
          ? "border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800"
          : "border-emerald-200 dark:border-emerald-800 bg-emerald-50/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.bg}`}>
          <Icon size={18} className={config.color} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{notification.title}</p>
              <span
                className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bg} ${config.color}`}
              >
                {TYPE_LABELS[notification.type] ?? notification.type}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!notification.isRead && (
                <button
                  onClick={() => onMarkRead(notification.id)}
                  className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400"
                  title="Mark as read"
                >
                  <CheckCircle2 size={14} />
                </button>
              )}
              <button
                onClick={() => onDelete(notification.id)}
                className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 hover:text-red-600"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300 dark:text-gray-300">{notification.message}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatDateTime(notification.createdAt)}</span>
            {notification.deepLink && (
              <Link
                href={notification.deepLink}
                className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline"
              >
                View <ArrowRight size={10} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30">
        <Bell size={36} className="text-emerald-300" />
      </div>
      <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">All caught up!</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">No notifications to show</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { value: "", label: "All" },
  { value: "ORDER_UPDATE", label: "Orders" },
  { value: "KHATA_REMINDER", label: "Khata" },
  { value: "OFFER", label: "Offers" },
  { value: "SYSTEM", label: "System" },
] as const;

export default function NotificationsPage() {
  const {
    notifications,
    total,
    unreadCount,
    page,
    totalPages,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore();

  const [typeFilter, setTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isClearing, setIsClearing] = useState(false);

  const loadNotifications = useCallback(
    (p: number, type: string) => {
      fetchNotifications(p, 20, type ? { type: type as NotificationType } : undefined).catch(
        () => toast.error("Failed to load notifications"),
      );
    },
    [fetchNotifications],
  );

  useEffect(() => {
    loadNotifications(currentPage, typeFilter);
  }, [currentPage, typeFilter, loadNotifications]);

  const handleMarkAllRead = async () => {
    setIsClearing(true);
    try {
      await markAllAsRead();
      toast.success("All marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setIsClearing(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead(id);
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
    } catch {
      toast.error("Failed to delete notification");
    }
  };

  const handlePageChange = (p: number) => {
    if (p < 1) return;
    setCurrentPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPagesNum = Math.ceil(total / 20);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Notifications</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
              : "No unread notifications"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={isClearing}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-50"
          >
            <CheckCheck size={14} />
            {isClearing ? "Marking..." : "Mark All Read"}
          </button>
        )}
      </div>

      {/* Type Filter Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setTypeFilter(tab.value);
              setCurrentPage(1);
            }}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              typeFilter === tab.value
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
      ) : notifications.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="space-y-3">
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Pagination */}
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
                      p === currentPage
                        ? "bg-emerald-700 text-white"
                        : "text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"
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
    </div>
  );
}
