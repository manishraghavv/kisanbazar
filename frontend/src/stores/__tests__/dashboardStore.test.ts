import { describe, it, expect, vi, beforeEach } from "vitest";
import { useDashboardStore } from "../dashboardStore";

vi.mock("@/lib/api-client", () => ({
  default: {
    get: vi.fn(),
  },
}));

import apiClient from "@/lib/api-client";

const mockApiClient = vi.mocked(apiClient);

describe("dashboardStore", () => {
  beforeEach(() => {
    useDashboardStore.setState({
      vendorData: null,
      adminData: null,
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  it("initializes with null data", () => {
    const state = useDashboardStore.getState();
    expect(state.vendorData).toBeNull();
    expect(state.adminData).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it("fetchVendorDashboard sets vendorData", async () => {
    const mockVendorData = {
      totalSales: 50000,
      totalOrders: 25,
      topProducts: [{ variantId: "v1", variantName: "10kg", productName: "Fertilizer A", productSlug: "fertilizer-a", totalSold: 15 }],
      khataSummary: { totalOutstanding: 12000, totalCreditLimit: 50000, activeAccounts: 8, overdueAccounts: 1 },
      commissions: { totalGrossAmount: 50000, totalCommissionAmount: 5000, totalNetAmount: 45000, count: 25 },
    };
    mockApiClient.get.mockResolvedValueOnce({ data: { success: true, data: mockVendorData } });

    await useDashboardStore.getState().fetchVendorDashboard();

    const state = useDashboardStore.getState();
    expect(state.vendorData).toEqual(mockVendorData);
    expect(state.isLoading).toBe(false);
  });

  it("fetchVendorDashboard handles errors gracefully", async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error("API error"));
    await expect(useDashboardStore.getState().fetchVendorDashboard()).rejects.toThrow("Failed to load vendor dashboard");
    expect(useDashboardStore.getState().isLoading).toBe(false);
  });

  it("fetchAdminDashboard sets adminData", async () => {
    const mockAdminData = {
      gmv: 200000,
      platformRevenue: 20000,
      users: { total: 150, farmers: 100, vendors: 50 },
      khata: { totalAccounts: 80, overdueAccounts: 5, defaultRate: "6.3" },
      orders: { total: 300, delivered: 250, cancelled: 20, conversionRate: "83.3" },
      recentRegistrations: [{ id: "u1", fullName: "John Doe", role: "FARMER", createdAt: "2024-01-15T00:00:00Z" }],
    };
    mockApiClient.get.mockResolvedValueOnce({ data: { success: true, data: mockAdminData } });

    await useDashboardStore.getState().fetchAdminDashboard();

    const state = useDashboardStore.getState();
    expect(state.adminData).toEqual(mockAdminData);
    expect(state.isLoading).toBe(false);
  });

  it("fetchAdminDashboard handles errors gracefully", async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error("API error"));
    await expect(useDashboardStore.getState().fetchAdminDashboard()).rejects.toThrow("Failed to load admin dashboard");
    expect(useDashboardStore.getState().isLoading).toBe(false);
  });
});
