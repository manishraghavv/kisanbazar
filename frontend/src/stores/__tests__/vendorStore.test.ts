import { describe, it, expect, vi, beforeEach } from "vitest";
import { useVendorStore } from "../vendorStore";

// Mock apiClient
vi.mock("@/lib/api-client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import apiClient from "@/lib/api-client";

const mockApiClient = vi.mocked(apiClient);

describe("vendorStore", () => {
  beforeEach(() => {
    useVendorStore.setState({
      lowStockItems: [],
      inventoryLogs: [],
      commissions: [],
      commissionSummary: null,
      settlements: [],
      isInventoryLoading: false,
      isCommissionsLoading: false,
      isSettlementsLoading: false,
    });
    vi.clearAllMocks();
  });

  it("initializes with empty state", () => {
    const state = useVendorStore.getState();
    expect(state.lowStockItems).toEqual([]);
    expect(state.commissions).toEqual([]);
    expect(state.settlements).toEqual([]);
    expect(state.commissionSummary).toBeNull();
  });

  it("fetchLowStock sets lowStockItems", async () => {
    const mockData = [
      { id: "v1", sku: "SKU001", variantName: "10kg", stockQuantity: 5, reorderThreshold: 20, product: { id: "p1", name: "Fertilizer A", slug: "fertilizer-a" } },
    ];
    mockApiClient.get.mockResolvedValueOnce({ data: { success: true, data: mockData } });

    await useVendorStore.getState().fetchLowStock();

    const state = useVendorStore.getState();
    expect(state.lowStockItems).toEqual(mockData);
    expect(state.isInventoryLoading).toBe(false);
  });

  it("fetchLowStock handles errors gracefully", async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error("API error"));
    await expect(useVendorStore.getState().fetchLowStock()).rejects.toThrow("Failed to load low stock items");
    expect(useVendorStore.getState().isInventoryLoading).toBe(false);
  });

  it("fetchCommissions sets commissions and summary", async () => {
    const mockCommissions = [
      { id: "c1", vendorId: "v1", orderId: "o1", commissionRate: 10, grossAmount: 1000, commissionAmount: 100, netAmount: 900, createdAt: "2024-01-01", order: { orderNumber: "ORD-001", totalAmount: 1000 } },
    ];
    const mockSummary = { totalGrossAmount: 1000, totalCommissionAmount: 100, totalNetAmount: 900, count: 1 };
    mockApiClient.get.mockResolvedValueOnce({
      data: { success: true, data: mockCommissions, summary: mockSummary, pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
    });

    await useVendorStore.getState().fetchCommissions(1, 20);

    const state = useVendorStore.getState();
    expect(state.commissions).toEqual(mockCommissions);
    expect(state.commissionSummary).toEqual(mockSummary);
    expect(state.isCommissionsLoading).toBe(false);
  });

  it("fetchSettlements sets settlements with pagination", async () => {
    const mockSettlements = [
      { id: "s1", vendorId: "v1", periodStart: "2024-01-01", periodEnd: "2024-01-31", totalSales: 5000, commissionAmount: 500, tdsDeducted: 50, payableAmount: 4450, status: "PAID", paidAt: "2024-02-01", utrNumber: "UTR123", createdAt: "2024-02-01" },
    ];
    mockApiClient.get.mockResolvedValueOnce({
      data: { success: true, data: mockSettlements, pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
    });

    await useVendorStore.getState().fetchSettlements("v1", 1, 20);

    const state = useVendorStore.getState();
    expect(state.settlements).toEqual(mockSettlements);
    expect(state.isSettlementsLoading).toBe(false);
  });

  it("adjustInventory posts to API and sets isAdjusting", async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: { success: true } });

    const promise = useVendorStore.getState().adjustInventory("v1", -5, "SALE");
    expect(useVendorStore.getState().isAdjusting).toBe(true);

    await promise;
    expect(mockApiClient.post).toHaveBeenCalledWith("/inventory/adjust", { variantId: "v1", quantityChange: -5, reason: "SALE" });
    expect(useVendorStore.getState().isAdjusting).toBe(false);
  });

  it("adjustInventory preserves error when API fails", async () => {
    mockApiClient.post.mockRejectedValueOnce(new Error("Failed"));
    await expect(useVendorStore.getState().adjustInventory("v1", 10, "RESTOCK")).rejects.toThrow("Failed");
    expect(useVendorStore.getState().isAdjusting).toBe(false);
  });
});
