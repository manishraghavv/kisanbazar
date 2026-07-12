import { create } from "zustand";
import apiClient from "@/lib/api-client";
import type { InventoryItem, InventoryLog, CommissionItem, CommissionSummary, SettlementItem } from "@/types/auth";

// ─── State Shape ─────────────────────────────────────────────────────────────

interface VendorState {
  // Inventory
  lowStockItems: InventoryItem[];
  inventoryLogs: InventoryLog[];
  inventoryLogsTotal: number;
  inventoryLogsPage: number;
  inventoryLogsTotalPages: number;
  isInventoryLoading: boolean;
  isAdjusting: boolean;

  // Commissions
  commissions: CommissionItem[];
  commissionSummary: CommissionSummary | null;
  commissionsTotal: number;
  commissionsPage: number;
  commissionsTotalPages: number;
  isCommissionsLoading: boolean;

  // Settlements
  settlements: SettlementItem[];
  settlementsTotal: number;
  settlementsPage: number;
  settlementsTotalPages: number;
  isSettlementsLoading: boolean;
}

interface VendorActions {
  // Inventory
  fetchLowStock: () => Promise<void>;
  fetchInventoryLogs: (page?: number, limit?: number) => Promise<void>;
  adjustInventory: (variantId: string, quantityChange: number, reason: string) => Promise<void>;

  // Commissions
  fetchCommissions: (page?: number, limit?: number, filters?: { orderId?: string; startDate?: string; endDate?: string }) => Promise<void>;

  // Settlements
  fetchSettlements: (vendorId: string, page?: number, limit?: number, status?: string) => Promise<void>;
}

type VendorStore = VendorState & VendorActions;

// ─── Initial state ───────────────────────────────────────────────────────────

const initialState: VendorState = {
  lowStockItems: [],
  inventoryLogs: [],
  inventoryLogsTotal: 0,
  inventoryLogsPage: 1,
  inventoryLogsTotalPages: 0,
  isInventoryLoading: false,
  isAdjusting: false,

  commissions: [],
  commissionSummary: null,
  commissionsTotal: 0,
  commissionsPage: 1,
  commissionsTotalPages: 0,
  isCommissionsLoading: false,

  settlements: [],
  settlementsTotal: 0,
  settlementsPage: 1,
  settlementsTotalPages: 0,
  isSettlementsLoading: false,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useVendorStore = create<VendorStore>()((set, get) => ({
  ...initialState,

  // ── Inventory ──────────────────────────────────────────────────────────────

  fetchLowStock: async () => {
    set({ isInventoryLoading: true });
    try {
      const response = await apiClient.get<{ success: boolean; data: InventoryItem[] }>(
        "/inventory/low-stock",
      );
      set({ lowStockItems: response.data.data, isInventoryLoading: false });
    } catch {
      set({ isInventoryLoading: false });
      throw new Error("Failed to load low stock items");
    }
  },

  fetchInventoryLogs: async (page = 1, limit = 20) => {
    set({ isInventoryLoading: true });
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: InventoryLog[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/inventory/logs", { params: { page, limit } });

      set({
        inventoryLogs: response.data.data,
        inventoryLogsTotal: response.data.pagination.total,
        inventoryLogsPage: response.data.pagination.page,
        inventoryLogsTotalPages: response.data.pagination.totalPages,
        isInventoryLoading: false,
      });
    } catch {
      set({ isInventoryLoading: false });
      throw new Error("Failed to load inventory logs");
    }
  },

  adjustInventory: async (variantId: string, quantityChange: number, reason: string) => {
    set({ isAdjusting: true });
    try {
      await apiClient.post("/inventory/adjust", { variantId, quantityChange, reason });
    } catch (err) {
      throw err;
    } finally {
      set({ isAdjusting: false });
    }
  },

  // ── Commissions ───────────────────────────────────────────────────────────

  fetchCommissions: async (page = 1, limit = 20, filters) => {
    set({ isCommissionsLoading: true });
    try {
      const params: Record<string, string | number> = { page, limit };
      if (filters?.orderId) params.orderId = filters.orderId;
      if (filters?.startDate) params.startDate = filters.startDate;
      if (filters?.endDate) params.endDate = filters.endDate;

      const response = await apiClient.get<{
        success: boolean;
        data: CommissionItem[];
        summary: CommissionSummary;
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/vendors/me/commissions", { params });

      set({
        commissions: response.data.data,
        commissionSummary: response.data.summary,
        commissionsTotal: response.data.pagination.total,
        commissionsPage: response.data.pagination.page,
        commissionsTotalPages: response.data.pagination.totalPages,
        isCommissionsLoading: false,
      });
    } catch {
      set({ isCommissionsLoading: false });
      throw new Error("Failed to load commissions");
    }
  },

  // ── Settlements ────────────────────────────────────────────────────────────

  fetchSettlements: async (vendorId: string, page = 1, limit = 20, status?: string) => {
    set({ isSettlementsLoading: true });
    try {
      const params: Record<string, string | number> = { page, limit };
      if (status) params.status = status;

      const response = await apiClient.get<{
        success: boolean;
        data: SettlementItem[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/vendors/${vendorId}/settlements`, { params });

      set({
        settlements: response.data.data,
        settlementsTotal: response.data.pagination.total,
        settlementsPage: response.data.pagination.page,
        settlementsTotalPages: response.data.pagination.totalPages,
        isSettlementsLoading: false,
      });
    } catch {
      set({ isSettlementsLoading: false });
      throw new Error("Failed to load settlements");
    }
  },
}));
