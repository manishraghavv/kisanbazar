import { create } from "zustand";
import apiClient from "@/lib/api-client";
import type { UserListItem, UserRole, UserStatus, Category, CreateCategoryPayload, UpdateCategoryPayload, ProductListItem, AuditLogItem } from "@/types/auth";

// ─── State Shape ─────────────────────────────────────────────────────────────

interface AdminState {
  // Users
  users: UserListItem[];
  usersTotal: number;
  usersPage: number;
  usersTotalPages: number;
  isUsersLoading: boolean;
  selectedUser: UserListItem | null;
  isUserLoading: boolean;

  // Categories
  categories: Category[];
  categoriesTotal: number;
  categoriesPage: number;
  categoriesTotalPages: number;
  isCategoriesLoading: boolean;
  isCategorySaving: boolean;

  // Products (moderation)
  moderationProducts: ProductListItem[];
  moderationTotal: number;
  moderationPage: number;
  moderationTotalPages: number;
  isModerationLoading: boolean;
  isModerating: boolean;

  // Audit Logs
  auditLogs: AuditLogItem[];
  auditLogsTotal: number;
  auditLogsPage: number;
  auditLogsTotalPages: number;
  isAuditLogsLoading: boolean;
}

interface AdminActions {
  // Users
  fetchUsers: (page?: number, limit?: number, filters?: { role?: string; status?: string; search?: string }) => Promise<void>;
  fetchUserById: (id: string) => Promise<void>;
  updateUser: (id: string, data: { fullName?: string; email?: string; role?: UserRole; status?: UserStatus }) => Promise<void>;
  updateUserStatus: (id: string, status: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  // Categories
  fetchAdminCategories: (page?: number, limit?: number, search?: string) => Promise<void>;
  createCategory: (data: CreateCategoryPayload) => Promise<void>;
  updateCategory: (id: string, data: UpdateCategoryPayload) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // Moderation
  fetchProductsForModeration: (page?: number, limit?: number, status?: string) => Promise<void>;
  moderateProduct: (id: string, status: string, moderationNote?: string) => Promise<void>;

  // Audit Logs
  fetchAuditLogs: (page?: number, limit?: number, filters?: { entityType?: string; action?: string; actorId?: string }) => Promise<void>;
}

type AdminStore = AdminState & AdminActions;

// ─── Initial state ───────────────────────────────────────────────────────────

const initialState: AdminState = {
  users: [],
  usersTotal: 0,
  usersPage: 1,
  usersTotalPages: 0,
  isUsersLoading: false,
  selectedUser: null,
  isUserLoading: false,

  categories: [],
  categoriesTotal: 0,
  categoriesPage: 1,
  categoriesTotalPages: 0,
  isCategoriesLoading: false,
  isCategorySaving: false,

  moderationProducts: [],
  moderationTotal: 0,
  moderationPage: 1,
  moderationTotalPages: 0,
  isModerationLoading: false,
  isModerating: false,

  auditLogs: [],
  auditLogsTotal: 0,
  auditLogsPage: 1,
  auditLogsTotalPages: 0,
  isAuditLogsLoading: false,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAdminStore = create<AdminStore>()((set, get) => ({
  ...initialState,

  // ── Users ─────────────────────────────────────────────────────────────────

  fetchUsers: async (page = 1, limit = 20, filters) => {
    set({ isUsersLoading: true });
    try {
      const params: Record<string, string | number> = { page, limit };
      if (filters?.role) params.role = filters.role;
      if (filters?.status) params.status = filters.status;
      if (filters?.search) params.search = filters.search;

      const response = await apiClient.get<{
        success: boolean;
        data: UserListItem[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/users", { params });

      set({
        users: response.data.data,
        usersTotal: response.data.pagination.total,
        usersPage: response.data.pagination.page,
        usersTotalPages: response.data.pagination.totalPages,
        isUsersLoading: false,
      });
    } catch {
      set({ isUsersLoading: false });
      throw new Error("Failed to load users");
    }
  },

  fetchUserById: async (id: string) => {
    set({ isUserLoading: true });
    try {
      const response = await apiClient.get<{ success: boolean; data: UserListItem }>(
        `/users/${id}`,
      );
      set({ selectedUser: response.data.data, isUserLoading: false });
    } catch {
      set({ isUserLoading: false });
      throw new Error("Failed to load user");
    }
  },

  updateUser: async (id, data) => {
    await apiClient.put(`/users/${id}`, data);
    await get().fetchUsers(get().usersPage, 20);
  },

  updateUserStatus: async (id: string, status: string) => {
    await apiClient.put(`/users/${id}/status`, { status });
    await get().fetchUsers(get().usersPage, 20);
  },

  deleteUser: async (id: string) => {
    await apiClient.delete(`/users/${id}`);
    await get().fetchUsers(get().usersPage, 20);
  },

  // ── Categories ────────────────────────────────────────────────────────────

  fetchAdminCategories: async (page = 1, limit = 20, search?: string) => {
    set({ isCategoriesLoading: true });
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;

      const response = await apiClient.get<{
        success: boolean;
        data: Category[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/categories", { params });

      set({
        categories: response.data.data,
        categoriesTotal: response.data.pagination.total,
        categoriesPage: response.data.pagination.page,
        categoriesTotalPages: response.data.pagination.totalPages,
        isCategoriesLoading: false,
      });
    } catch {
      set({ isCategoriesLoading: false });
      throw new Error("Failed to load categories");
    }
  },

  createCategory: async (data: CreateCategoryPayload) => {
    set({ isCategorySaving: true });
    try {
      await apiClient.post("/categories", data);
      await get().fetchAdminCategories(1, 20);
    } catch (err) {
      throw err;
    } finally {
      set({ isCategorySaving: false });
    }
  },

  updateCategory: async (id: string, data: UpdateCategoryPayload) => {
    set({ isCategorySaving: true });
    try {
      await apiClient.put(`/categories/${id}`, data);
      await get().fetchAdminCategories(get().categoriesPage, 20);
    } catch (err) {
      throw err;
    } finally {
      set({ isCategorySaving: false });
    }
  },

  deleteCategory: async (id: string) => {
    await apiClient.delete(`/categories/${id}`);
    await get().fetchAdminCategories(get().categoriesPage, 20);
  },

  // ── Moderation ─────────────────────────────────────────────────────────────

  fetchProductsForModeration: async (page = 1, limit = 20, status = "DRAFT") => {
    set({ isModerationLoading: true });
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: ProductListItem[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/products", { params: { page, limit, status } });

      set({
        moderationProducts: response.data.data,
        moderationTotal: response.data.pagination.total,
        moderationPage: response.data.pagination.page,
        moderationTotalPages: response.data.pagination.totalPages,
        isModerationLoading: false,
      });
    } catch {
      set({ isModerationLoading: false });
      throw new Error("Failed to load products");
    }
  },

  moderateProduct: async (id: string, status: string, moderationNote?: string) => {
    set({ isModerating: true });
    try {
      await apiClient.put(`/products/${id}/moderate`, { status, moderationNote });
      // Refresh list
      await get().fetchProductsForModeration(get().moderationPage, 20);
    } catch (err) {
      throw err;
    } finally {
      set({ isModerating: false });
    }
  },

  // ── Audit Logs ────────────────────────────────────────────────────────────

  fetchAuditLogs: async (page = 1, limit = 20, filters) => {
    set({ isAuditLogsLoading: true });
    try {
      const params: Record<string, string | number> = { page, limit };
      if (filters?.entityType) params.entityType = filters.entityType;
      if (filters?.action) params.action = filters.action;
      if (filters?.actorId) params.actorId = filters.actorId;

      const response = await apiClient.get<{
        success: boolean;
        data: AuditLogItem[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/audit-logs", { params });

      set({
        auditLogs: response.data.data,
        auditLogsTotal: response.data.pagination.total,
        auditLogsPage: response.data.pagination.page,
        auditLogsTotalPages: response.data.pagination.totalPages,
        isAuditLogsLoading: false,
      });
    } catch {
      set({ isAuditLogsLoading: false });
      throw new Error("Failed to load audit logs");
    }
  },
}));
