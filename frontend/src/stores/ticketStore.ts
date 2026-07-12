import { create } from "zustand";
import apiClient from "@/lib/api-client";
import type { SupportTicket, TicketMessage, CreateTicketPayload } from "@/types/auth";

// ─── State Shape ─────────────────────────────────────────────────────────────

interface TicketState {
  tickets: SupportTicket[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  selectedTicket: SupportTicket | null;
  isTicketLoading: boolean;
  isCreatingTicket: boolean;
}

interface TicketActions {
  /** Fetch paginated ticket list */
  fetchTickets: (page?: number, limit?: number, filters?: { status?: string; priority?: string; category?: string }) => Promise<void>;
  /** Create a new support ticket */
  createTicket: (data: CreateTicketPayload) => Promise<void>;
  /** Get a single ticket with messages */
  fetchTicketById: (id: string) => Promise<void>;
  /** Add a message to a ticket */
  addMessage: (ticketId: string, message: string) => Promise<void>;
  /** Close/resolve a ticket */
  updateTicketStatus: (ticketId: string, status: string) => Promise<void>;
}

type TicketStore = TicketState & TicketActions;

// ─── Initial state ───────────────────────────────────────────────────────────

const initialState: TicketState = {
  tickets: [],
  total: 0,
  page: 1,
  totalPages: 0,
  isLoading: true,
  selectedTicket: null,
  isTicketLoading: false,
  isCreatingTicket: false,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useTicketStore = create<TicketStore>()((set, get) => ({
  ...initialState,

  fetchTickets: async (page = 1, limit = 20, filters) => {
    set({ isLoading: true });
    try {
      const params: Record<string, string | number> = { page, limit };
      if (filters?.status) params.status = filters.status;
      if (filters?.priority) params.priority = filters.priority;
      if (filters?.category) params.category = filters.category;

      const response = await apiClient.get<{
        success: boolean;
        data: SupportTicket[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/support/tickets", { params });

      set({
        tickets: response.data.data,
        total: response.data.pagination.total,
        page: response.data.pagination.page,
        totalPages: response.data.pagination.totalPages,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to load support tickets");
    }
  },

  createTicket: async (data: CreateTicketPayload) => {
    set({ isCreatingTicket: true });
    try {
      await apiClient.post("/support/tickets", data);
      // Refresh list
      await get().fetchTickets(1, 20);
    } catch (err) {
      throw err;
    } finally {
      set({ isCreatingTicket: false });
    }
  },

  fetchTicketById: async (id: string) => {
    set({ isTicketLoading: true });
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: SupportTicket & { messages: TicketMessage[] };
      }>(`/support/tickets/${id}`);

      set({ selectedTicket: response.data.data, isTicketLoading: false });
    } catch {
      set({ isTicketLoading: false });
      throw new Error("Failed to load ticket details");
    }
  },

  addMessage: async (ticketId: string, message: string) => {
    set({ isTicketLoading: true });
    try {
      await apiClient.post(`/support/tickets/${ticketId}/messages`, { message });
      // Refresh ticket
      await get().fetchTicketById(ticketId);
    } catch (err) {
      throw err;
    } finally {
      set({ isTicketLoading: false });
    }
  },

  updateTicketStatus: async (ticketId: string, status: string) => {
    try {
      await apiClient.put(`/support/tickets/${ticketId}`, { status, remarks: `Status changed to ${status}` });
      await get().fetchTicketById(ticketId);
    } catch (err) {
      throw err;
    }
  },
}));
