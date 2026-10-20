import { create } from "zustand";
import apiClient from "@/lib/api-client";
import type { SalesReportItem, ProductPerformanceItem, KhataOverdueItem } from "@/types/auth";

interface ReportFilters {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  vendorId?: string;
}

interface ReportState {
  salesReport: SalesReportItem[];
  salesSummary: { totalAmount: number; totalOrders: number } | null;
  productPerformance: ProductPerformanceItem[];
  khataOverdue: KhataOverdueItem[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  activeTab: "sales" | "performance" | "overdue";
}

interface ReportActions {
  setActiveTab: (tab: "sales" | "performance" | "overdue") => void;
  fetchSalesReport: (page?: number, limit?: number, filters?: ReportFilters) => Promise<void>;
  fetchProductPerformance: (page?: number, limit?: number, filters?: ReportFilters) => Promise<void>;
  fetchKhataOverdue: (page?: number, limit?: number, minOverdueDays?: number) => Promise<void>;
}

type ReportStore = ReportState & ReportActions;

const initialState: ReportState = {
  salesReport: [],
  salesSummary: null,
  productPerformance: [],
  khataOverdue: [],
  total: 0,
  page: 1,
  totalPages: 0,
  isLoading: false,
  activeTab: "sales",
};

export const useReportStore = create<ReportStore>()((set) => ({
  ...initialState,

  setActiveTab: (tab) => set({ activeTab: tab }),

  fetchSalesReport: async (page = 1, limit = 20, filters) => {
    set({ isLoading: true });
    try {
      const params: Record<string, string | number> = { page, limit };
      if (filters?.startDate) params.startDate = filters.startDate;
      if (filters?.endDate) params.endDate = filters.endDate;
      if (filters?.categoryId) params.categoryId = filters.categoryId;

      const response = await apiClient.get<{
        success: boolean;
        data: SalesReportItem[];
        summary: { totalAmount: number; totalOrders: number };
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/reports/sales", { params });

      set({
        salesReport: response.data.data,
        salesSummary: response.data.summary,
        total: response.data.pagination.total,
        page: response.data.pagination.page,
        totalPages: response.data.pagination.totalPages,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to load sales report");
    }
  },

  fetchProductPerformance: async (page = 1, limit = 20, filters) => {
    set({ isLoading: true });
    try {
      const params: Record<string, string | number> = { page, limit };
      if (filters?.startDate) params.startDate = filters.startDate;
      if (filters?.endDate) params.endDate = filters.endDate;
      if (filters?.categoryId) params.categoryId = filters.categoryId;
      if (filters?.vendorId) params.vendorId = filters.vendorId;

      const response = await apiClient.get<{
        success: boolean;
        data: ProductPerformanceItem[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/reports/product-performance", { params });

      set({
        productPerformance: response.data.data,
        total: response.data.pagination.total,
        page: response.data.pagination.page,
        totalPages: response.data.pagination.totalPages,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to load product performance");
    }
  },

  fetchKhataOverdue: async (page = 1, limit = 20, minOverdueDays = 1) => {
    set({ isLoading: true });
    try {
      const params: Record<string, string | number> = { page, limit, minOverdueDays };

      const response = await apiClient.get<{
        success: boolean;
        data: KhataOverdueItem[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/reports/khata-overdue", { params });

      set({
        khataOverdue: response.data.data,
        total: response.data.pagination.total,
        page: response.data.pagination.page,
        totalPages: response.data.pagination.totalPages,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to load overdue report");
    }
  },
}));
