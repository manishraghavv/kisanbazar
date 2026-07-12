import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCouponStore } from "../couponStore";

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

describe("couponStore", () => {
  beforeEach(() => {
    useCouponStore.setState({
      coupons: [],
      total: 0,
      page: 1,
      totalPages: 0,
      isLoading: false,
      isSaving: false,
    });
    vi.clearAllMocks();
  });

  it("initializes with empty state", () => {
    const state = useCouponStore.getState();
    expect(state.coupons).toEqual([]);
    expect(state.total).toBe(0);
    expect(state.isLoading).toBe(false);
  });

  it("fetchCoupons sets coupons and pagination", async () => {
    const mockCoupons = [
      { id: "c1", code: "SUMMER25", title: "Summer Sale", type: "PERCENTAGE", value: 25, minimumAmount: 500, maximumDiscount: 2000, usageLimit: 100, perUserLimit: 1, applicableTo: "ALL", isActive: true, startsAt: "2024-01-01T00:00:00Z", expiresAt: "2024-06-30T00:00:00Z", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    ];
    mockApiClient.get.mockResolvedValueOnce({
      data: { success: true, data: mockCoupons, pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
    });

    await useCouponStore.getState().fetchCoupons(1, 20);

    const state = useCouponStore.getState();
    expect(state.coupons).toEqual(mockCoupons);
    expect(state.total).toBe(1);
    expect(state.isLoading).toBe(false);
  });

  it("fetchCoupons handles errors gracefully", async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error("API error"));
    await expect(useCouponStore.getState().fetchCoupons()).rejects.toThrow("Failed to load coupons");
    expect(useCouponStore.getState().isLoading).toBe(false);
  });

  it("createCoupon posts data and refreshes list", async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: { success: true } });
    mockApiClient.get.mockResolvedValueOnce({
      data: { success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
    });

    const data = { code: "FLAT500", title: "Flat ₹500", type: "FIXED" as const, value: 500, startsAt: "2024-01-01T00:00:00Z", expiresAt: "2024-06-30T00:00:00Z" };
    await useCouponStore.getState().createCoupon(data);

    expect(mockApiClient.post).toHaveBeenCalledWith("/coupons", data);
    expect(useCouponStore.getState().isSaving).toBe(false);
  });

  it("updateCoupon sends PUT and refreshes list", async () => {
    mockApiClient.put.mockResolvedValueOnce({ data: { success: true } });
    mockApiClient.get.mockResolvedValueOnce({
      data: { success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
    });

    await useCouponStore.getState().updateCoupon("c1", { title: "Updated Title" });

    expect(mockApiClient.put).toHaveBeenCalledWith("/coupons/c1", { title: "Updated Title" });
  });

  it("deleteCoupon sends DELETE and refreshes list", async () => {
    mockApiClient.delete.mockResolvedValueOnce({ data: { success: true } });
    mockApiClient.get.mockResolvedValueOnce({
      data: { success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
    });

    await useCouponStore.getState().deleteCoupon("c1");

    expect(mockApiClient.delete).toHaveBeenCalledWith("/coupons/c1");
  });

  it("createCoupon preserves error when API fails", async () => {
    mockApiClient.post.mockRejectedValueOnce(new Error("Duplicate code"));
    const data = { code: "EXISTING", title: "Exists", type: "PERCENTAGE" as const, value: 10, startsAt: "2024-01-01T00:00:00Z", expiresAt: "2024-06-30T00:00:00Z" };

    await expect(useCouponStore.getState().createCoupon(data)).rejects.toThrow("Duplicate code");
    expect(useCouponStore.getState().isSaving).toBe(false);
  });
});
