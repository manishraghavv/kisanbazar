import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAdminStore } from "../adminStore";

vi.mock("@/lib/api-client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import apiClient from "@/lib/api-client";

const mockApiClient = vi.mocked(apiClient);

describe("adminStore", () => {
  beforeEach(() => {
    useAdminStore.setState({
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
    });
    vi.clearAllMocks();
  });

  it("initializes with empty state", () => {
    const state = useAdminStore.getState();
    expect(state.users).toEqual([]);
    expect(state.categories).toEqual([]);
    expect(state.moderationProducts).toEqual([]);
    expect(state.auditLogs).toEqual([]);
  });

  // ── Users ─────────────────────────────────────────────────────────────────

  it("fetchUsers loads paginated user list", async () => {
    const mockUsers = [
      { id: "u1", fullName: "John Farmer", phoneNumber: "9876543210", email: null, role: "FARMER", status: "ACTIVE", isPhoneVerified: true, createdAt: "2024-01-01", lastLoginAt: null },
    ];
    mockApiClient.get.mockResolvedValueOnce({
      data: { success: true, data: mockUsers, pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
    });

    await useAdminStore.getState().fetchUsers(1, 20);

    expect(useAdminStore.getState().users).toEqual(mockUsers);
    expect(useAdminStore.getState().isUsersLoading).toBe(false);
  });

  it("fetchUsers handles error", async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error("API error"));
    await expect(useAdminStore.getState().fetchUsers()).rejects.toThrow("Failed to load users");
    expect(useAdminStore.getState().isUsersLoading).toBe(false);
  });

  it("fetchUserById loads a single user", async () => {
    const mockUser = { id: "u1", fullName: "John", phoneNumber: "9876543210", email: null, role: "FARMER", status: "ACTIVE", isPhoneVerified: true, createdAt: "2024-01-01", lastLoginAt: null };
    mockApiClient.get.mockResolvedValueOnce({ data: { success: true, data: mockUser } });

    await useAdminStore.getState().fetchUserById("u1");

    expect(useAdminStore.getState().selectedUser).toEqual(mockUser);
    expect(useAdminStore.getState().isUserLoading).toBe(false);
  });

  it("updateUserStatus sends PUT and refreshes list", async () => {
    useAdminStore.setState({ usersPage: 1 });
    mockApiClient.put.mockResolvedValue({ data: { success: true } });
    mockApiClient.get.mockResolvedValue({ data: { success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } } });

    await useAdminStore.getState().updateUserStatus("u1", "BLOCKED");

    expect(mockApiClient.put).toHaveBeenCalledWith("/users/u1/status", { status: "BLOCKED" });
    expect(mockApiClient.get).toHaveBeenCalled();
  });

  it("deleteUser sends DELETE and refreshes list", async () => {
    useAdminStore.setState({ usersPage: 1 });
    mockApiClient.delete.mockResolvedValue({ data: { success: true } });
    mockApiClient.get.mockResolvedValue({ data: { success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } } });

    await useAdminStore.getState().deleteUser("u1");

    expect(mockApiClient.delete).toHaveBeenCalledWith("/users/u1");
  });

  // ── Categories ────────────────────────────────────────────────────────────

  it("fetchAdminCategories loads paginated categories", async () => {
    const mockCats = [{ id: "c1", name: "Fertilizers", slug: "fertilizers", sortOrder: 1, parentId: null, iconUrl: null, nameHi: null }];
    mockApiClient.get.mockResolvedValueOnce({
      data: { success: true, data: mockCats, pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
    });

    await useAdminStore.getState().fetchAdminCategories(1, 20);

    expect(useAdminStore.getState().categories).toEqual(mockCats);
    expect(useAdminStore.getState().isCategoriesLoading).toBe(false);
  });

  it("createCategory posts and refreshes list", async () => {
    mockApiClient.post.mockResolvedValue({ data: { success: true } });
    mockApiClient.get.mockResolvedValue({ data: { success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } } });

    await useAdminStore.getState().createCategory({ name: "Seeds" });

    expect(mockApiClient.post).toHaveBeenCalledWith("/categories", { name: "Seeds" });
    expect(useAdminStore.getState().isCategorySaving).toBe(false);
  });

  it("deleteCategory sends DELETE and refreshes", async () => {
    useAdminStore.setState({ categoriesPage: 1 });
    mockApiClient.delete.mockResolvedValue({ data: { success: true } });
    mockApiClient.get.mockResolvedValue({ data: { success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } } });

    await useAdminStore.getState().deleteCategory("c1");

    expect(mockApiClient.delete).toHaveBeenCalledWith("/categories/c1");
  });

  // ── Moderation ────────────────────────────────────────────────────────────

  it("fetchProductsForModeration loads paginated products", async () => {
    const mockProducts = [{ id: "p1", name: "Test Product", status: "DRAFT", category: { id: "c1", name: "C1", slug: "c1" }, vendor: { id: "v1", businessName: "Vendor" }, variants: [], images: [], _count: { reviews: 0 }, slug: "test", nameHi: null, description: null, hsnCode: null, gstRate: null, unitOfMeasure: null, applicableCrops: [], seasonalFlag: false, createdAt: "2024-01-01", updatedAt: "2024-01-01" }];
    mockApiClient.get.mockResolvedValueOnce({
      data: { success: true, data: mockProducts, pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
    });

    await useAdminStore.getState().fetchProductsForModeration(1, 20, "DRAFT");

    expect(mockApiClient.get).toHaveBeenCalledWith("/products", { params: { page: 1, limit: 20, status: "DRAFT" } });
    expect(useAdminStore.getState().moderationProducts.length).toBe(1);
    expect(useAdminStore.getState().isModerationLoading).toBe(false);
  });

  it("moderateProduct sends PUT and refreshes", async () => {
    useAdminStore.setState({ moderationPage: 1 });
    mockApiClient.put.mockResolvedValue({ data: { success: true } });
    mockApiClient.get.mockResolvedValue({ data: { success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } } });

    await useAdminStore.getState().moderateProduct("p1", "APPROVED", "Good product");

    expect(mockApiClient.put).toHaveBeenCalledWith("/products/p1/moderate", { status: "APPROVED", moderationNote: "Good product" });
    expect(useAdminStore.getState().isModerating).toBe(false);
  });

  // ── Audit Logs ────────────────────────────────────────────────────────────

  it("fetchAuditLogs loads paginated logs", async () => {
    const mockLogs = [{ id: "l1", actorId: "u1", actorRole: "ADMIN", action: "UPDATE", entityType: "USER", entityId: "u2", oldData: { status: "ACTIVE" }, newData: { status: "BLOCKED" }, ipAddress: "127.0.0.1", createdAt: "2024-01-01T00:00:00Z" }];
    mockApiClient.get.mockResolvedValueOnce({
      data: { success: true, data: mockLogs, pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
    });

    await useAdminStore.getState().fetchAuditLogs(1, 20);

    expect(useAdminStore.getState().auditLogs).toEqual(mockLogs);
    expect(useAdminStore.getState().isAuditLogsLoading).toBe(false);
  });

  it("fetchAuditLogs passes filter params", async () => {
    mockApiClient.get.mockResolvedValueOnce({
      data: { success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } },
    });

    await useAdminStore.getState().fetchAuditLogs(1, 20, { entityType: "USER", action: "CREATE" });

    expect(mockApiClient.get).toHaveBeenCalledWith("/audit-logs", {
      params: { page: 1, limit: 20, entityType: "USER", action: "CREATE" },
    });
  });
});
