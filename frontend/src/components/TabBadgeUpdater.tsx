"use client";

import { useEffect } from "react";
import { useNotificationStore } from "@/stores/notificationStore";
import { useAuthStore } from "@/stores/authStore";

/**
 * Periodically polls unread notification count and updates the document title
 * to show a badge count (e.g. "(3) Kisaan Bazaar").
 * Renders nothing to the DOM.
 */
export function TabBadgeUpdater() {
  const { unreadCount, fetchUnreadCount } = useNotificationStore();
  const { user } = useAuthStore();
  const BASE_TITLE = "Kisaan Bazaar — Multi-Vendor Agri-Commerce";

  useEffect(() => {
    if (!user) return;

    // Initial fetch
    fetchUnreadCount().catch(() => {});

    // Poll every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount().catch(() => {});
    }, 30_000);

    return () => clearInterval(interval);
  }, [user, fetchUnreadCount]);

  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) ${BASE_TITLE}` : BASE_TITLE;
  }, [unreadCount]);

  return null;
}
