import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTicketStore } from "../ticketStore";

vi.mock("@/lib/api-client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

import apiClient from "@/lib/api-client";

const mockApiClient = vi.mocked(apiClient);

describe("ticketStore", () => {
  beforeEach(() => {
    useTicketStore.setState({
      tickets: [],
      total: 0,
      page: 1,
      totalPages: 0,
      isLoading: true,
      selectedTicket: null,
      isTicketLoading: false,
      isCreatingTicket: false,
    });
    vi.clearAllMocks();
  });

  it("initializes with default state", () => {
    const state = useTicketStore.getState();
    expect(state.tickets).toEqual([]);
    expect(state.selectedTicket).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it("fetchTickets sets tickets and pagination", async () => {
    const mockTickets = [
      { id: "t1", userId: "u1", title: "Help needed", description: "Cant log in", priority: "HIGH", status: "OPEN", category: "OTHER", referenceId: null, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z", user: { fullName: "Test User" }, messageCount: 2 },
    ];
    mockApiClient.get.mockResolvedValueOnce({
      data: { success: true, data: mockTickets, pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
    });

    await useTicketStore.getState().fetchTickets(1, 20);

    const state = useTicketStore.getState();
    expect(state.tickets).toEqual(mockTickets);
    expect(state.total).toBe(1);
    expect(state.isLoading).toBe(false);
  });

  it("fetchTickets handles errors gracefully", async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error("API error"));
    await expect(useTicketStore.getState().fetchTickets()).rejects.toThrow("Failed to load support tickets");
    expect(useTicketStore.getState().isLoading).toBe(false);
  });

  it("createTicket posts data and refreshes list", async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: { success: true } });
    mockApiClient.get.mockResolvedValueOnce({
      data: { success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
    });

    await useTicketStore.getState().createTicket({ title: "Bug", description: "Something broke", priority: "HIGH" });

    expect(mockApiClient.post).toHaveBeenCalledWith("/support/tickets", { title: "Bug", description: "Something broke", priority: "HIGH" });
    expect(useTicketStore.getState().isCreatingTicket).toBe(false);
  });

  it("fetchTicketById sets selectedTicket with messages", async () => {
    const mockTicket = {
      id: "t1", userId: "u1", title: "Help", description: "Issue", priority: "MEDIUM", status: "OPEN", category: "OTHER", referenceId: null, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z", user: { fullName: "User" },
      messages: [
        { id: "m1", ticketId: "t1", senderId: "u1", senderName: "User", message: "Hello!", isInternal: false, createdAt: "2024-01-01T00:00:00Z" },
      ],
    };
    mockApiClient.get.mockResolvedValueOnce({ data: { success: true, data: mockTicket } });

    await useTicketStore.getState().fetchTicketById("t1");

    const state = useTicketStore.getState();
    expect(state.selectedTicket).toBeDefined();
    expect(state.selectedTicket?.id).toBe("t1");
    expect(state.selectedTicket?.messages).toHaveLength(1);
    expect(state.isTicketLoading).toBe(false);
  });

  it("addMessage posts message and refreshes ticket", async () => {
    const mockTicket = {
      id: "t1", userId: "u1", title: "Help", description: "Issue", priority: "MEDIUM", status: "OPEN", category: "OTHER", referenceId: null, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z", user: { fullName: "User" },
      messages: [],
    };
    mockApiClient.post.mockResolvedValueOnce({ data: { success: true } });
    mockApiClient.get.mockResolvedValueOnce({ data: { success: true, data: mockTicket } });

    await useTicketStore.getState().addMessage("t1", "New reply");

    expect(mockApiClient.post).toHaveBeenCalledWith("/support/tickets/t1/messages", { message: "New reply" });
    expect(useTicketStore.getState().isTicketLoading).toBe(false);
  });

  it("updateTicketStatus changes ticket status", async () => {
    const mockTicket = {
      id: "t1", userId: "u1", title: "Help", description: "Issue", priority: "LOW", status: "RESOLVED", category: "OTHER", referenceId: null, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z", user: { fullName: "User" },
      messages: [],
    };
    mockApiClient.put.mockResolvedValueOnce({ data: { success: true } });
    mockApiClient.get.mockResolvedValueOnce({ data: { success: true, data: mockTicket } });

    await useTicketStore.getState().updateTicketStatus("t1", "RESOLVED");

    expect(mockApiClient.put).toHaveBeenCalledWith("/support/tickets/t1", { status: "RESOLVED", remarks: "Status changed to RESOLVED" });
    expect(useTicketStore.getState().selectedTicket?.status).toBe("RESOLVED");
  });
});
