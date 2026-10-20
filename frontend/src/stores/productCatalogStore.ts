import { create } from "zustand";
import apiClient from "@/lib/api-client";
import type { ProductListItem, ProductDetail, Category } from "@/types/auth";

// ─── State Shape ─────────────────────────────────────────────────────────────

interface ProductCatalogState {
  products: ProductListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLoading: boolean;
  categories: Category[];
  categoriesLoading: boolean;
  selectedProduct: ProductDetail | null;
  isProductLoading: boolean;
}

interface ProductCatalogActions {
  /** Fetch paginated product list with filters */
  fetchProducts: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    status?: string;
    minPrice?: number;
    maxPrice?: number;
    seasonalFlag?: boolean;
    crop?: string;
    sortBy?: string;
    sortOrder?: string;
  }) => Promise<void>;
  /** Fetch category tree */
  fetchCategories: () => Promise<void>;
  /** Fetch single product detail */
  fetchProductById: (id: string) => Promise<ProductDetail>;
  /** Clear selected product */
  clearSelectedProduct: () => void;
  /** Create a new product */
  createProduct: (data: {
    categoryId: string;
    name: string;
    description?: string;
    unitOfMeasure?: string;
    seasonalFlag?: boolean;
  }) => Promise<{ id: string }>;
  /** Add a variant to a product */
  createVariant: (productId: string, data: {
    sku: string;
    mrp: number;
    sellingPrice: number;
    stockQuantity: number;
    variantName?: string;
  }) => Promise<void>;
  /** Add an image URL to a product */
  addProductImage: (productId: string, data: {
    imageUrl: string;
    isPrimary: boolean;
    sortOrder: number;
  }) => Promise<void>;
}

type ProductCatalogStore = ProductCatalogState & ProductCatalogActions;

// ─── Initial state ───────────────────────────────────────────────────────────

const initialState: ProductCatalogState = {
  products: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
  isLoading: true,
  categories: [],
  categoriesLoading: false,
  selectedProduct: null,
  isProductLoading: false,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useProductCatalogStore = create<ProductCatalogStore>()((set) => ({
  // ── State ────────────────────────────────────────────────────────────────
  ...initialState,

  // ── Actions ──────────────────────────────────────────────────────────────

  fetchProducts: async (params = {}) => {
    set({ isLoading: true });
    try {
      const {
        page = 1,
        limit = 20,
        search,
        categoryId,
        status,
        minPrice,
        maxPrice,
        seasonalFlag,
        crop,
        sortBy,
        sortOrder,
      } = params;

      const queryParams: Record<string, string | number | boolean> = { page, limit };
      if (search) queryParams.search = search;
      if (categoryId) queryParams.categoryId = categoryId;
      if (status) queryParams.status = status;
      if (minPrice !== undefined) queryParams.minPrice = minPrice;
      if (maxPrice !== undefined) queryParams.maxPrice = maxPrice;
      if (seasonalFlag !== undefined) queryParams.seasonalFlag = seasonalFlag;
      if (crop) queryParams.crop = crop;
      if (sortBy) queryParams.sortBy = sortBy;
      if (sortOrder) queryParams.sortOrder = sortOrder;

      const response = await apiClient.get<{
        success: boolean;
        data: ProductListItem[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>("/products", { params: queryParams });

      set({
        products: response.data.data,
        total: response.data.pagination.total,
        page: response.data.pagination.page,
        limit: response.data.pagination.limit,
        totalPages: response.data.pagination.totalPages,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to fetch products");
    }
  },

  fetchCategories: async () => {
    set({ categoriesLoading: true });
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: Category[];
      }>("/categories/tree");

      set({ categories: response.data.data, categoriesLoading: false });
    } catch {
      set({ categoriesLoading: false });
      throw new Error("Failed to fetch categories");
    }
  },

  fetchProductById: async (id: string) => {
    set({ isProductLoading: true });
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: ProductDetail;
      }>(`/products/${id}`);

      set({ selectedProduct: response.data.data, isProductLoading: false });
      return response.data.data;
    } catch {
      set({ isProductLoading: false });
      throw new Error("Failed to fetch product details");
    }
  },

  clearSelectedProduct: () => {
    set({ selectedProduct: null });
  },

  createProduct: async (data) => {
    const response = await apiClient.post<{ success: boolean; data: { id: string } }>(
      "/products",
      data
    );
    return response.data.data;
  },

  createVariant: async (productId, data) => {
    await apiClient.post(`/products/${productId}/variants`, data);
  },

  addProductImage: async (productId, data) => {
    await apiClient.post(`/products/${productId}/images`, data);
  },
}));
