import { create } from "zustand";
import apiClient from "@/lib/api-client";
import type { VendorDashboardData, AdminDashboardData } from "@/types/auth";

// ─── State Shape ─────────────────────────────────────────────────────────────

interface DashboardState {
  vendorData: VendorDashboardData | null;
  adminData: AdminDashboardData | null;
  isLoading: boolean;
}

interface DashboardActions {
  /** Fetch vendor dashboard data */
  fetchVendorDashboard: () => Promise<void>;
  /** Fetch admin dashboard data */
  fetchAdminDashboard: () => Promise<void>;
}

type DashboardStore = DashboardState & DashboardActions;

// ─── Initial state ───────────────────────────────────────────────────────────

const initialState: DashboardState = {
  vendorData: null,
  adminData: null,
  isLoading: false,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useDashboardStore = create<DashboardStore>()((set) => ({
  ...initialState,

  fetchVendorDashboard: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: VendorDashboardData;
      }>("/vendors/me/dashboard");

      set({ vendorData: response.data.data, isLoading: false });
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to load vendor dashboard");
    }
  },

  fetchAdminDashboard: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: AdminDashboardData;
      }>("/admin/dashboard");

      set({ adminData: response.data.data, isLoading: false });
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to load admin dashboard");
    }
  },
}));
