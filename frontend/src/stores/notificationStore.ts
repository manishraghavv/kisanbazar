import { create } from "zustand";
import apiClient from "@/lib/api-client";
import type { NotificationItem, NotificationType } from "@/types/auth";

// ─── State Shape ─────────────────────────────────────────────────────────────

interface NotificationState {
  notifications: NotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
}

interface NotificationActions {
  /** Fetch paginated notification list */
  fetchNotifications: (page?: number, limit?: number, filter?: { isRead?: boolean; type?: NotificationType }) => Promise<void>;
  /** Fetch unread count only */
  fetchUnreadCount: () => Promise<number>;
  /** Mark a single notification as read */
  markAsRead: (id: string) => Promise<void>;
  /** Mark all notifications as read */
  markAllAsRead: () => Promise<void>;
  /** Delete a notification */
  deleteNotification: (id: string) => Promise<void>;
}

type NotificationStore = NotificationState & NotificationActions;

// ─── Initial state ───────────────────────────────────────────────────────────

const initialState: NotificationState = {
  notifications: [],
  total: 0,
  unreadCount: 0,
  page: 1,
  totalPages: 0,
  isLoading: true,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  ...initialState,

  fetchNotifications: async (page = 1, limit = 20, filter) => {
    set({ isLoading: true });
    try {
      const params: Record<string, string | number | boolean> = { page, limit };
      if (filter?.isRead !== undefined) params.isRead = filter.isRead;
      if (filter?.type) params.type = filter.type;

      const response = await apiClient.get<{
        success: boolean;
        data: NotificationItem[];
        unreadCount: number;
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/notifications", { params });

      set({
        notifications: response.data.data,
        total: response.data.pagination.total,
        unreadCount: response.data.unreadCount,
        page: response.data.pagination.page,
        totalPages: response.data.pagination.totalPages,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to load notifications");
    }
  },

  fetchUnreadCount: async () => {
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: { unreadCount: number };
      }>("/notifications/unread-count");

      const count = response.data.data.unreadCount;
      set({ unreadCount: count });
      return count;
    } catch {
      return 0;
    }
  },

  markAsRead: async (id: string) => {
    await apiClient.put(`/notifications/${id}/read`);
    // Optimistic local update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllAsRead: async () => {
    await apiClient.put("/notifications/read-all");
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },

  deleteNotification: async (id: string) => {
    await apiClient.delete(`/notifications/${id}`);
    // Optimistic removal
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      total: state.total - 1,
      unreadCount: Math.max(
        0,
        state.unreadCount - (state.notifications.find((n) => n.id === id)?.isRead ? 0 : 1),
      ),
    }));
  },
}));
