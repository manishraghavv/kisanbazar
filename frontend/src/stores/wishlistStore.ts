import { create } from "zustand";
import apiClient from "@/lib/api-client";
import type { ProductListItem } from "@/types/auth";

// ─── State Shape ─────────────────────────────────────────────────────────────

export interface WishlistItem extends ProductListItem {
  wishlistItemId: string;
}

interface WishlistState {
  items: WishlistItem[];
  isLoading: boolean;
  isAdding: boolean;
}

interface WishlistActions {
  /** Fetch user's wishlist */
  getWishlist: () => Promise<void>;
  /** Add product to wishlist */
  addItem: (productId: string) => Promise<void>;
  /** Remove item from wishlist */
  removeItem: (itemId: string) => Promise<void>;
  /** Move item from wishlist to cart */
  moveToCart: (itemId: string) => Promise<void>;
}

type WishlistStore = WishlistState & WishlistActions;

// ─── Initial state ───────────────────────────────────────────────────────────

const initialState: WishlistState = {
  items: [],
  isLoading: true,
  isAdding: false,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useWishlistStore = create<WishlistStore>()((set, get) => ({
  // ── State ────────────────────────────────────────────────────────────────
  ...initialState,

  // ── Actions ──────────────────────────────────────────────────────────────

  getWishlist: async () => {
    set({ isLoading: true });
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: {
          id: string;
          items: Array<{
            id: string;
            productId: string;
            product: ProductListItem;
          }>;
        };
      }>("/wishlist");

      // Map the wishlist response to product list items
      const items: WishlistItem[] = response.data.data.items.map((item) => ({
        ...item.product,
        wishlistItemId: item.id,
      }));

      set({ items, isLoading: false });
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to load wishlist");
    }
  },

  addItem: async (productId: string) => {
    set({ isAdding: true });
    try {
      await apiClient.post("/wishlist/items", { productId });
      // Refresh wishlist
      await get().getWishlist();
    } catch (err) {
      throw err;
    } finally {
      set({ isAdding: false });
    }
  },

  removeItem: async (itemId: string) => {
    // Optimistic removal
    set((state) => ({
    items: state.items.filter((item) => item.wishlistItemId !== itemId),
    }));

    try {
      await apiClient.delete(`/wishlist/items/${itemId}`);
      await get().getWishlist();
    } catch {
      await get().getWishlist();
      throw new Error("Failed to remove item");
    }
  },

  moveToCart: async (itemId: string) => {
    try {
      await apiClient.post(`/wishlist/items/${itemId}/move`);
      // Remove from wishlist and refresh
      await get().getWishlist();
    } catch (err) {
      throw err;
    }
  },
}));
