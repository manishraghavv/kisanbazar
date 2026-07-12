import { create } from "zustand";
import apiClient from "@/lib/api-client";
import type { CartWithItems } from "@/types/auth";

// ─── State Shape ─────────────────────────────────────────────────────────────

interface CartState {
  cart: CartWithItems | null;
  isLoading: boolean;
  isAdding: boolean;
}

interface CartActions {
  /** Fetch user's cart */
  getCart: () => Promise<void>;
  /** Add item to cart */
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  /** Update cart item quantity */
  updateItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  /** Remove item from cart */
  removeItem: (itemId: string) => Promise<void>;
  /** Merge guest cart items into user cart after login */
  mergeCart: (items: Array<{ variantId: string; quantity: number }>) => Promise<void>;
  /** Clear entire cart */
  clearCart: () => Promise<void>;
  /** Place an order */
  createOrder: (data: {
    addressId: string;
    paymentMethod: string;
    khataAccountId?: string | null;
    couponCode?: string;
  }) => Promise<{ id: string; orderNumber: string; totalAmount: number }>;
}

type CartStore = CartState & CartActions;

// ─── Initial state ───────────────────────────────────────────────────────────

const initialState: CartState = {
  cart: null,
  isLoading: true,
  isAdding: false,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useCartStore = create<CartStore>()((set, get) => ({
  // ── State ────────────────────────────────────────────────────────────────
  ...initialState,

  // ── Actions ──────────────────────────────────────────────────────────────

  getCart: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: CartWithItems;
      }>("/orders/cart");

      set({ cart: response.data.data, isLoading: false });
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to load cart");
    }
  },

  addItem: async (variantId: string, quantity = 1) => {
    set({ isAdding: true });
    try {
      await apiClient.post("/orders/cart/items", { variantId, quantity });
      // Refresh cart
      await get().getCart();
    } catch (err) {
      throw err;
    } finally {
      set({ isAdding: false });
    }
  },

  updateItemQuantity: async (itemId: string, quantity: number) => {
    // Optimistic update
    set((state) => ({
      cart: state.cart
        ? {
            ...state.cart,
            items: state.cart.items.map((item) =>
              item.id === itemId ? { ...item, quantity } : item,
            ),
          }
        : null,
    }));

    try {
      await apiClient.put(`/orders/cart/items/${itemId}`, { quantity });
      // Refresh to get server-confirmed state
      await get().getCart();
    } catch {
      // Revert on failure by refreshing
      await get().getCart();
      throw new Error("Failed to update quantity");
    }
  },

  removeItem: async (itemId: string) => {
    // Optimistic removal
    set((state) => ({
      cart: state.cart
        ? {
            ...state.cart,
            items: state.cart.items.filter((item) => item.id !== itemId),
          }
        : null,
    }));

    try {
      await apiClient.delete(`/orders/cart/items/${itemId}`);
      await get().getCart();
    } catch {
      await get().getCart();
      throw new Error("Failed to remove item");
    }
  },

  mergeCart: async (items) => {
    if (items.length === 0) return;
    try {
      await apiClient.post("/orders/cart/merge", { items });
      await get().getCart();
    } catch {
      // Silent — merge is best-effort, items are already in the backend cart
    }
  },

  clearCart: async () => {
    try {
      await apiClient.delete("/orders/cart");
      set({ cart: null });
    } catch {
      throw new Error("Failed to clear cart");
    }
  },

  createOrder: async (data: {
    addressId: string;
    paymentMethod: string;
    khataAccountId?: string | null;
    couponCode?: string;
  }) => {
    const res = await apiClient.post<{
      success: boolean;
      data: { id: string; orderNumber: string; totalAmount: number };
      message?: string;
    }>("/orders", {
      ...data,
      channel: "web",
    } as Record<string, unknown>);
    // Clear local cart state after successful order
    set({ cart: null });
    return res.data.data;
  },
}));
