import { create } from "zustand";
import apiClient from "@/lib/api-client";
import type {
  OrderListItem,
  OrderDetail,
  OrderStatusHistoryItem,
  OrderStatus,
} from "@/types/auth";

// ─── State Shape ─────────────────────────────────────────────────────────────

interface OrderState {
  orders: OrderListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLoading: boolean;
  selectedOrder: OrderDetail | null;
  isOrderLoading: boolean;
  statusHistory: OrderStatusHistoryItem[];
}

interface OrderActions {
  /** Fetch paginated order list with optional status filter */
  fetchOrders: (
    page?: number,
    limit?: number,
    status?: OrderStatus | "",
  ) => Promise<void>;
  /** Fetch single order detail */
  fetchOrderById: (id: string) => Promise<OrderDetail>;
  /** Cancel an order (only PENDING / CONFIRMED) */
  cancelOrder: (id: string, reason: string) => Promise<void>;
  /** Request a return (only DELIVERED / SHIPPED) */
  returnOrder: (id: string, reason: string) => Promise<void>;
  /** Clear selected order */
  clearSelectedOrder: () => void;
}

type OrderStore = OrderState & OrderActions;

// ─── Initial state ───────────────────────────────────────────────────────────

const initialState: OrderState = {
  orders: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0,
  isLoading: true,
  selectedOrder: null,
  isOrderLoading: false,
  statusHistory: [],
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useOrderStore = create<OrderStore>()((set, get) => ({
  // ── State ────────────────────────────────────────────────────────────────
  ...initialState,

  // ── Actions ──────────────────────────────────────────────────────────────

  fetchOrders: async (page = 1, limit = 10, status: OrderStatus | "" = "") => {
    set({ isLoading: true });
    try {
      const params: Record<string, string | number> = { page, limit };
      if (status) params.status = status;

      const response = await apiClient.get<{
        success: boolean;
        data: OrderListItem[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>("/orders", { params });

      set({
        orders: response.data.data,
        total: response.data.pagination.total,
        page: response.data.pagination.page,
        limit: response.data.pagination.limit,
        totalPages: response.data.pagination.totalPages,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to fetch orders");
    }
  },

  fetchOrderById: async (id: string) => {
    set({ isOrderLoading: true });
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: OrderDetail;
      }>(`/orders/${id}`);

      set({ selectedOrder: response.data.data, isOrderLoading: false });
      return response.data.data;
    } catch {
      set({ isOrderLoading: false });
      throw new Error("Failed to fetch order details");
    }
  },

  cancelOrder: async (id: string, reason: string) => {
    await apiClient.post(`/orders/${id}/cancel`, { reason });
    // Update local order status
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === id ? { ...o, status: "CANCELLED" as OrderStatus, cancellationReason: reason } : o,
      ),
      selectedOrder:
        state.selectedOrder?.id === id
          ? { ...state.selectedOrder, status: "CANCELLED" as OrderStatus, cancellationReason: reason }
          : state.selectedOrder,
    }));
  },

  returnOrder: async (id: string, reason: string) => {
    await apiClient.post(`/orders/${id}/return`, { reason });
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === id ? { ...o, status: "RETURNED" as OrderStatus } : o,
      ),
      selectedOrder:
        state.selectedOrder?.id === id
          ? { ...state.selectedOrder, status: "RETURNED" as OrderStatus }
          : state.selectedOrder,
    }));
  },

  clearSelectedOrder: () => {
    set({ selectedOrder: null, statusHistory: [] });
  },
}));
