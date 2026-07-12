import { create } from "zustand";
import apiClient from "@/lib/api-client";
import type { Address, CreateAddressPayload, UpdateAddressPayload } from "@/types/auth";

// ─── State Shape ─────────────────────────────────────────────────────────────

interface AddressState {
  addresses: Address[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLoading: boolean;
}

interface AddressActions {
  /** Fetch paginated address list */
  fetchAddresses: (page?: number, limit?: number) => Promise<void>;
  /** Create a new address */
  createAddress: (data: CreateAddressPayload) => Promise<Address>;
  /** Update an existing address */
  updateAddress: (id: string, data: UpdateAddressPayload) => Promise<void>;
  /** Delete an address */
  deleteAddress: (id: string) => Promise<void>;
  /** Set an address as the default */
  setDefaultAddress: (id: string) => Promise<void>;
  /** Get the default address */
  defaultAddress: () => Address | undefined;
}

type AddressStore = AddressState & AddressActions;

// ─── Initial state ───────────────────────────────────────────────────────────

const initialState: AddressState = {
  addresses: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
  isLoading: true,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAddressStore = create<AddressStore>()((set, get) => ({
  // ── State ────────────────────────────────────────────────────────────────
  ...initialState,

  // ── Actions ──────────────────────────────────────────────────────────────

  fetchAddresses: async (page = 1, limit = 20) => {
    set({ isLoading: true });
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: Address[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/addresses", { params: { page, limit } });

      set({
        addresses: response.data.data,
        total: response.data.pagination.total,
        page: response.data.pagination.page,
        limit: response.data.pagination.limit,
        totalPages: response.data.pagination.totalPages,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to fetch addresses");
    }
  },

  createAddress: async (data: CreateAddressPayload) => {
    const response = await apiClient.post<{
      success: boolean;
      data: Address;
    }>("/addresses", data);

    // Refresh the list to get updated order
    await get().fetchAddresses(get().page, get().limit);

    return response.data.data;
  },

  updateAddress: async (id: string, data: UpdateAddressPayload) => {
    await apiClient.put<{
      success: boolean;
      data: Address;
    }>(`/addresses/${id}`, data);

    // If setting as default, update local state to reflect it
    if (data.isDefault) {
      set((state) => ({
        addresses: state.addresses.map((a) => ({
          ...a,
          isDefault: a.id === id ? true : false,
        })),
      }));
    }

    // Refresh to get consistent server state
    await get().fetchAddresses(get().page, get().limit);
  },

  deleteAddress: async (id: string) => {
    await apiClient.delete(`/addresses/${id}`);

    set((state) => ({
      addresses: state.addresses.filter((a) => a.id !== id),
      total: state.total - 1,
    }));

    // Refresh to get consistent pagination
    await get().fetchAddresses(get().page, get().limit);
  },

  setDefaultAddress: async (id: string) => {
    await apiClient.put<{
      success: boolean;
      data: Address;
    }>(`/addresses/${id}/default`);

    // Optimistically update local state
    set((state) => ({
      addresses: state.addresses.map((a) => ({
        ...a,
        isDefault: a.id === id,
      })),
    }));

    // Refresh to get consistent server state
    await get().fetchAddresses(get().page, get().limit);
  },

  defaultAddress: () => {
    return get().addresses.find((a) => a.isDefault);
  },
}));
