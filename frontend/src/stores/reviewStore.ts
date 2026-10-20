import { create } from "zustand";
import apiClient from "@/lib/api-client";

export interface Review {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  comment: string | null;
  photoUrls: string[];
  isVerifiedBuyer: boolean;
  helpfulCount: number;
  createdAt: string;
  user: { fullName: string };
}

interface ReviewState {
  reviews: Record<string, Review[]>;
  totals: Record<string, number>;
  avgRatings: Record<string, number>;
  isLoading: boolean;
  isSaving: boolean;
}

interface ReviewActions {
  fetchReviews: (productId: string, page?: number) => Promise<void>;
  createReview: (productId: string, data: { rating: number; comment?: string }) => Promise<void>;
  markHelpful: (reviewId: string, productId: string) => Promise<void>;
  deleteReview: (reviewId: string, productId: string) => Promise<void>;
}

type ReviewStore = ReviewState & ReviewActions;

export const useReviewStore = create<ReviewStore>()((set) => ({
  reviews: {},
  totals: {},
  avgRatings: {},
  isLoading: false,
  isSaving: false,

  fetchReviews: async (productId, page = 1) => {
    set({ isLoading: true });
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: Review[];
        pagination: { total: number };
        avgRating?: number;
      }>(`/products/${productId}/reviews`, { params: { page, limit: 20 } });

      const reviews = res.data.data;
      const total = res.data.pagination.total;

      // Compute avg rating client-side if backend doesn't return it
      const avg =
        res.data.avgRating ??
        (reviews.length > 0
          ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
          : 0);

      set((state) => ({
        reviews: { ...state.reviews, [productId]: reviews },
        totals: { ...state.totals, [productId]: total },
        avgRatings: { ...state.avgRatings, [productId]: avg },
        isLoading: false,
      }));
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to load reviews");
    }
  },

  createReview: async (productId, data) => {
    set({ isSaving: true });
    try {
      const res = await apiClient.post<{ success: boolean; data: Review }>(
        `/products/${productId}/reviews`,
        data
      );
      const newReview = res.data.data;
      set((state) => {
        const existing = state.reviews[productId] ?? [];
        const updated = [newReview, ...existing];
        const avg = updated.reduce((s, r) => s + r.rating, 0) / updated.length;
        return {
          reviews: { ...state.reviews, [productId]: updated },
          totals: { ...state.totals, [productId]: (state.totals[productId] ?? 0) + 1 },
          avgRatings: { ...state.avgRatings, [productId]: avg },
          isSaving: false,
        };
      });
    } catch {
      set({ isSaving: false });
      throw new Error("Failed to submit review");
    }
  },

  markHelpful: async (reviewId, productId) => {
    await apiClient.post(`/reviews/${reviewId}/helpful`);
    set((state) => ({
      reviews: {
        ...state.reviews,
        [productId]: (state.reviews[productId] ?? []).map((r) =>
          r.id === reviewId ? { ...r, helpfulCount: r.helpfulCount + 1 } : r
        ),
      },
    }));
  },

  deleteReview: async (reviewId, productId) => {
    await apiClient.delete(`/reviews/${reviewId}`);
    set((state) => {
      const updated = (state.reviews[productId] ?? []).filter((r) => r.id !== reviewId);
      const avg = updated.length > 0 ? updated.reduce((s, r) => s + r.rating, 0) / updated.length : 0;
      return {
        reviews: { ...state.reviews, [productId]: updated },
        totals: { ...state.totals, [productId]: Math.max(0, (state.totals[productId] ?? 1) - 1) },
        avgRatings: { ...state.avgRatings, [productId]: avg },
      };
    });
  },
}));
