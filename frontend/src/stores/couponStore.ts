import { create } from "zustand";
import apiClient from "@/lib/api-client";
import type { CouponItem, CreateCouponPayload } from "@/types/auth";

interface CouponState {
  coupons: CouponItem[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  isSaving: boolean;
}

interface CouponActions {
  fetchCoupons: (page?: number, limit?: number, filters?: { isActive?: boolean; type?: string }) => Promise<void>;
  createCoupon: (data: CreateCouponPayload) => Promise<void>;
  updateCoupon: (id: string, data: Partial<CreateCouponPayload>) => Promise<void>;
  deleteCoupon: (id: string) => Promise<void>;
}

type CouponStore = CouponState & CouponActions;

const initialState: CouponState = {
  coupons: [],
  total: 0,
  page: 1,
  totalPages: 0,
  isLoading: false,
  isSaving: false,
};

export const useCouponStore = create<CouponStore>()((set, get) => ({
  ...initialState,

  fetchCoupons: async (page = 1, limit = 20, filters) => {
    set({ isLoading: true });
    try {
      const params: Record<string, string | number | boolean> = { page, limit };
      if (filters?.isActive !== undefined) params.isActive = filters.isActive;
      if (filters?.type) params.type = filters.type;

      const response = await apiClient.get<{
        success: boolean;
        data: CouponItem[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/coupons", { params });

      set({
        coupons: response.data.data,
        total: response.data.pagination.total,
        page: response.data.pagination.page,
        totalPages: response.data.pagination.totalPages,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to load coupons");
    }
  },

  createCoupon: async (data: CreateCouponPayload) => {
    set({ isSaving: true });
    try {
      await apiClient.post("/coupons", data);
      await get().fetchCoupons(1, 20);
    } catch (err) {
      throw err;
    } finally {
      set({ isSaving: false });
    }
  },

  updateCoupon: async (id: string, data: Partial<CreateCouponPayload>) => {
    set({ isSaving: true });
    try {
      await apiClient.put(`/coupons/${id}`, data);
      await get().fetchCoupons(get().page, 20);
    } catch (err) {
      throw err;
    } finally {
      set({ isSaving: false });
    }
  },

  deleteCoupon: async (id: string) => {
    await apiClient.delete(`/coupons/${id}`);
    await get().fetchCoupons(get().page, 20);
  },
}));
