import { describe, it, expect, vi, beforeEach } from "vitest";
import { useNotificationStore } from "../notificationStore";

vi.mock("@/lib/api-client", () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import apiClient from "@/lib/api-client";

const mockApiClient = vi.mocked(apiClient);

describe("notificationStore", () => {
  beforeEach(() => {
    useNotificationStore.setState({
      notifications: [],
      total: 0,
      unreadCount: 0,
      page: 1,
      totalPages: 0,
      isLoading: true,
    });
    vi.clearAllMocks();
  });

  it("initializes with default state", () => {
    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([]);
    expect(state.total).toBe(0);
    expect(state.unreadCount).toBe(0);
    expect(state.isLoading).toBe(true);
  });

  it("fetchNotifications sets notifications and pagination", async () => {
    const mockNotifications = [
      { id: "n1", userId: "u1", title: "Order confirmed", message: "Your order #123", type: "ORDER_UPDATE", isRead: false, deepLink: null, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    ];
    mockApiClient.get.mockResolvedValueOnce({
      data: { success: true, data: mockNotifications, unreadCount: 1, pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
    });

    await useNotificationStore.getState().fetchNotifications(1, 20);

    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual(mockNotifications);
    expect(state.total).toBe(1);
    expect(state.unreadCount).toBe(1);
    expect(state.isLoading).toBe(false);
  });

  it("fetchNotifications handles errors gracefully", async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error("API error"));
    await expect(useNotificationStore.getState().fetchNotifications()).rejects.toThrow("Failed to load notifications");
    expect(useNotificationStore.getState().isLoading).toBe(false);
  });

  it("fetchUnreadCount updates unreadCount", async () => {
    mockApiClient.get.mockResolvedValueOnce({
      data: { success: true, data: { unreadCount: 5 } },
    });

    const count = await useNotificationStore.getState().fetchUnreadCount();
    expect(count).toBe(5);
    expect(useNotificationStore.getState().unreadCount).toBe(5);
  });

  it("fetchUnreadCount returns 0 on failure", async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error("API error"));
    const count = await useNotificationStore.getState().fetchUnreadCount();
    expect(count).toBe(0);
  });

  it("markAsRead updates notification optimistically", async () => {
    useNotificationStore.setState({
      notifications: [
        { id: "n1", userId: "u1", title: "Test", message: "Test msg", type: "ORDER_UPDATE", isRead: false, deepLink: null, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
      ],
      unreadCount: 1,
    });
    mockApiClient.put.mockResolvedValueOnce({ data: { success: true } });

    await useNotificationStore.getState().markAsRead("n1");

    const state = useNotificationStore.getState();
    expect(state.notifications[0].isRead).toBe(true);
    expect(state.unreadCount).toBe(0);
  });

  it("markAllAsRead marks all notifications as read", async () => {
    useNotificationStore.setState({
      notifications: [
        { id: "n1", userId: "u1", title: "Test", message: "Msg", type: "ORDER_UPDATE", isRead: false, deepLink: null, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
        { id: "n2", userId: "u1", title: "Test 2", message: "Msg 2", type: "SYSTEM", isRead: false, deepLink: null, createdAt: "2024-01-02T00:00:00Z", updatedAt: "2024-01-02T00:00:00Z" },
      ],
      unreadCount: 2,
    });
    mockApiClient.put.mockResolvedValueOnce({ data: { success: true } });

    await useNotificationStore.getState().markAllAsRead();

    const state = useNotificationStore.getState();
    expect(state.notifications.every((n) => n.isRead)).toBe(true);
    expect(state.unreadCount).toBe(0);
  });

  it("deleteNotification removes notification optimistically", async () => {
    useNotificationStore.setState({
      notifications: [
        { id: "n1", userId: "u1", title: "Test", message: "Msg", type: "ORDER_UPDATE", isRead: false, deepLink: null, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
      ],
      total: 1,
      unreadCount: 1,
    });
    mockApiClient.delete.mockResolvedValueOnce({ data: { success: true } });

    await useNotificationStore.getState().deleteNotification("n1");

    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(0);
    expect(state.total).toBe(0);
    expect(state.unreadCount).toBe(0);
  });
});
