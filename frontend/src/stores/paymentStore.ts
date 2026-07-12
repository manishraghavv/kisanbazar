import { create } from "zustand";
import apiClient from "@/lib/api-client";
import type { PaymentListItem } from "@/types/auth";

// ─── State Shape ─────────────────────────────────────────────────────────────

interface PaymentState {
  payments: PaymentListItem[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  selectedPayment: PaymentListItem | null;
  isPaymentLoading: boolean;
}

interface PaymentActions {
  /** Fetch paginated payment list */
  getPayments: (page?: number, limit?: number, status?: string) => Promise<void>;
  /** Fetch single payment detail */
  getPaymentById: (id: string) => Promise<void>;
}

type PaymentStore = PaymentState & PaymentActions;

// ─── Initial state ───────────────────────────────────────────────────────────

const initialState: PaymentState = {
  payments: [],
  total: 0,
  page: 1,
  totalPages: 0,
  isLoading: true,
  selectedPayment: null,
  isPaymentLoading: false,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const usePaymentStore = create<PaymentStore>()((set) => ({
  ...initialState,

  getPayments: async (page = 1, limit = 20, status?: string) => {
    set({ isLoading: true });
    try {
      const params: Record<string, string | number> = { page, limit };
      if (status) params.status = status;

      const response = await apiClient.get<{
        success: boolean;
        data: PaymentListItem[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/payments", { params });

      set({
        payments: response.data.data,
        total: response.data.pagination.total,
        page: response.data.pagination.page,
        totalPages: response.data.pagination.totalPages,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to load payments");
    }
  },

  getPaymentById: async (id: string) => {
    set({ isPaymentLoading: true });
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: PaymentListItem;
      }>(`/payments/${id}`);

      set({ selectedPayment: response.data.data, isPaymentLoading: false });
    } catch {
      set({ isPaymentLoading: false });
      throw new Error("Failed to load payment details");
    }
  },
}));
