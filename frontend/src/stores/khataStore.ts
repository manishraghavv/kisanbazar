import { create } from "zustand";
import apiClient from "@/lib/api-client";
import type {
  KhataAccount,
  KhataTransaction,
  KhataRequest,
  KhataAccountStatus,
} from "@/types/auth";

// ─── State Shape ─────────────────────────────────────────────────────────────

interface KhataState {
  accounts: KhataAccount[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  selectedAccount: KhataAccount | null;
  isAccountLoading: boolean;
  transactions: KhataTransaction[];
  transactionsTotal: number;
  transactionsLoading: boolean;
  requests: KhataRequest[];
}

interface KhataActions {
  /** Fetch khata accounts list (filtered by user role) */
  getAccounts: (page?: number, limit?: number, status?: KhataAccountStatus) => Promise<void>;
  /** Fetch single account detail */
  getAccountById: (id: string) => Promise<KhataAccount>;
  /** Get transactions for an account */
  getTransactions: (accountId: string, page?: number, limit?: number) => Promise<void>;
  /** Clear selected account */
  clearSelectedAccount: () => void;
  /** Create a new khata account (vendor only) */
  createAccount: (data: {
    farmerId: string;
    creditLimitAmount: number;
    interestRatePct?: number;
    creditPeriodDays?: number;
  }) => Promise<KhataAccount>;
  /** Search farmers by phone/name (for vendor account creation) */
  searchFarmers: (
    query: string,
  ) => Promise<
    Array<{
      id: string;
      fullName: string;
      phoneNumber: string;
      farmerProfile?: { id: string } | null;
    }>
  >;
}

type KhataStore = KhataState & KhataActions;

// ─── Initial state ───────────────────────────────────────────────────────────

const initialState: KhataState = {
  accounts: [],
  total: 0,
  page: 1,
  totalPages: 0,
  isLoading: true,
  selectedAccount: null,
  isAccountLoading: false,
  transactions: [],
  transactionsTotal: 0,
  transactionsLoading: false,
  requests: [],
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useKhataStore = create<KhataStore>()((set) => ({
  ...initialState,

  getAccounts: async (page = 1, limit = 20, status?: KhataAccountStatus) => {
    set({ isLoading: true });
    try {
      const params: Record<string, string | number> = { page, limit };
      if (status) params.status = status;

      const response = await apiClient.get<{
        success: boolean;
        data: { accounts: KhataAccount[]; total: number; page: number; limit: number; totalPages: number };
      }>("/khata/accounts", { params });

      set({
        accounts: response.data.data.accounts,
        total: response.data.data.total,
        page: response.data.data.page,
        totalPages: response.data.data.totalPages,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to load khata accounts");
    }
  },

  getAccountById: async (id: string) => {
    set({ isAccountLoading: true });
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: KhataAccount & {
          vendor: { id: string; businessName: string };
          farmer: { id: string; user: { fullName: string; phoneNumber: string } };
        };
      }>(`/khata/accounts/${id}`);

      set({ selectedAccount: response.data.data, isAccountLoading: false });
      return response.data.data;
    } catch {
      set({ isAccountLoading: false });
      throw new Error("Failed to load account details");
    }
  },

  getTransactions: async (accountId: string, page = 1, limit = 20) => {
    set({ transactionsLoading: true });
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: { transactions: KhataTransaction[]; total: number; page: number; totalPages: number };
      }>(`/khata/accounts/${accountId}/transactions`, {
        params: { page, limit },
      });

      set({
        transactions: response.data.data.transactions,
        transactionsTotal: response.data.data.total,
        transactionsLoading: false,
      });
    } catch {
      set({ transactionsLoading: false });
      throw new Error("Failed to load transactions");
    }
  },

  createAccount: async (data) => {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      data: KhataAccount;
    }>("/khata/accounts", data);
    return response.data.data;
  },

  searchFarmers: async (query) => {
    const response = await apiClient.get<{
      success: boolean;
      data: Array<{
        id: string;
        fullName: string;
        phoneNumber: string;
        farmerProfile?: { id: string } | null;
      }>;
    }>("/users/farmers", {
      params: { search: query, role: "FARMER" },
    });
    return response.data.data;
  },

  clearSelectedAccount: () => {
    set({ selectedAccount: null, transactions: [], transactionsTotal: 0 });
  },
}));
