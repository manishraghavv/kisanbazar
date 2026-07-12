"use client";

import { useEffect } from "react";
import { useNotificationStore } from "@/stores/notificationStore";
import { useAuthStore } from "@/stores/authStore";

/**
 * Provides badge counts for the sidebar navigation.
 * Currently returns unread notification count.
 * Can be extended with order counts, ticket counts, etc.
 */
export function useSidebarBadges(): Record<string, number> {
  const { unreadCount, fetchUnreadCount } = useNotificationStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      fetchUnreadCount().catch(() => {});
    }
  }, [user, fetchUnreadCount]);

  return {
    notifications: unreadCount,
  };
}
