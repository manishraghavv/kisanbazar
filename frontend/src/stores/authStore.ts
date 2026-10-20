import { create } from "zustand";
import { persist } from "zustand/middleware";
import apiClient from "@/lib/api-client";
import type {
  User,
  FarmerProfile,
  VendorProfile,
  LoginResponse,
  RegisterResponse,
  RefreshTokenResponse,
  UserRole,
} from "@/types/auth";

// ─── State Shape ─────────────────────────────────────────────────────────────

interface AuthState {
  /** Full user object (null when not authenticated or not yet loaded) */
  user: User | null;
  /** JWT access token (short-lived, ~15 min) */
  accessToken: string | null;
  /** JWT refresh token (long-lived, ~7 days) */
  refreshToken: string | null;
  /** Derived — true when a valid access/refresh token exists */
  isAuthenticated: boolean;
  /** True while initializing (silent refresh on app load) or performing auth actions */
  isLoading: boolean;
}

interface AuthActions {
  /** Verify phone number with OTP. Throws on failure. */
  verifyOtp: (phoneNumber: string, otp: string) => Promise<void>;
  /** Resend OTP to phone number. Throws on failure. */
  resendOtp: (phoneNumber: string) => Promise<void>;
  /** Register a new user. Throws on failure. */
  register: (data: {
    fullName: string;
    phoneNumber: string;
    email?: string;
    password: string;
    role: UserRole;
    referralCode?: string;
    languagePref?: string;
  }) => Promise<RegisterResponse>;
  /** Attempt login with phone + password. Throws on failure. */
  login: (phoneNumber: string, password: string) => Promise<void>;
  /** Logout: clears tokens, calls backend logout, and resets state */
  logout: () => Promise<void>;
  /** Silently refresh the access token using the stored refresh token. Returns true on success. */
  refreshAccessToken: () => Promise<boolean>;
  /** Update the stored user object (e.g. after profile edit) */
  setUser: (user: User) => void;
  /** Initialize auth state on app mount — attempts silent refresh if a refresh token exists */
  initialize: () => Promise<void>;
  /** Convenience: redirect to role-appropriate dashboard */
  getDashboardRoute: () => string;
  /** Send forgot-password OTP to phone number. Throws on failure. */
  forgotPassword: (phoneNumber: string) => Promise<void>;
  /** Reset password using phone + OTP + new password. Throws on failure. */
  resetPassword: (phoneNumber: string, otp: string, newPassword: string) => Promise<void>;
  /** Update vendor-specific profile (business name, GST, PAN). Throws on failure. */
  updateVendorProfile: (data: {
    businessName?: string;
    gstNumber?: string;
    panNumber?: string;
  }) => Promise<void>;
  /** Update farmer-specific profile (village, land, crops, etc.). Throws on failure. */
  updateFarmerProfile: (data: {
    village?: string;
    district?: string;
    state?: string;
    pincode?: string;
    landAreaAcres?: number;
    primaryCrops?: string[];
  }) => Promise<void>;
  /** Update profile fields (fullName, email, languagePref). Throws on failure. */
  updateProfile: (data: {
    fullName?: string;
    email?: string;
    languagePref?: string;
  }) => Promise<void>;
  /** Fetch full user profile from /users/me (used after login or silent refresh) */
  fetchFullProfile: () => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

// ─── Initial state ───────────────────────────────────────────────────────────

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true, // starts loading until initialize() completes
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // ── State ────────────────────────────────────────────────────────────
      ...initialState,

      // ── Actions ──────────────────────────────────────────────────────────

      verifyOtp: async (phoneNumber: string, otp: string) => {
        await apiClient.post("/auth/verify-otp", { phoneNumber, otp });
      },

      resendOtp: async (phoneNumber: string) => {
        await apiClient.post("/auth/resend-otp", { phoneNumber });
      },

      register: async (data: {
        fullName: string;
        phoneNumber: string;
        email?: string;
        password: string;
        role: UserRole;
        referralCode?: string;
        languagePref?: string;
      }) => {
        const response = await apiClient.post<{
          success: boolean;
          data: RegisterResponse;
        }>("/auth/register", {
          ...data,
          deviceType: "web",
        });

        return response.data.data;
      },

      login: async (phoneNumber: string, password: string) => {
        set({ isLoading: true });

        try {
          const response = await apiClient.post<{
            success: boolean;
            data: LoginResponse;
          }>("/auth/login", { phoneNumber, password });

          const { accessToken, refreshToken, user } = response.data.data;

          // Store the partial user from login, then fetch full profile in background
          set({
            accessToken,
            refreshToken,
            user: user as User,
            isAuthenticated: true,
            isLoading: false,
          });

          // Fetch full profile (includes farmerProfile, vendorProfile, etc.)
          get().fetchFullProfile();
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        const { refreshToken } = get();

        try {
          if (refreshToken) {
            await apiClient.post("/auth/logout", { refreshToken });
          }
        } catch {
          // Silently ignore logout API failures — we clear local state anyway
        } finally {
          set({ ...initialState, isLoading: false });
        }
      },

      refreshAccessToken: async () => {
        const currentRefreshToken = get().refreshToken;
        if (!currentRefreshToken) return false;

        try {
          const response = await apiClient.post<{
            success: boolean;
            data: RefreshTokenResponse;
          }>("/auth/refresh-token", {
            refreshToken: currentRefreshToken,
          });

          const { accessToken } = response.data.data;

          set({
            accessToken,
            isAuthenticated: true,
          });

          return true;
        } catch (error) {
          // Only an explicit rejection of the refresh token ends the session; a network error or
          // 5xx must not log the user out.
          const status = (error as { response?: { status?: number } }).response?.status;
          if (status === 400 || status === 401 || status === 403) {
            set({ ...initialState, isLoading: false });
          }
          return false;
        }
      },

      setUser: (user: User) => {
        set({ user });
      },

      initialize: async () => {
        const { refreshToken } = get();

        if (!refreshToken) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        // Attempt silent refresh
        const success = await get().refreshAccessToken();

        if (success) {
          // Fetch full user profile
          await get().fetchFullProfile();
        }

        set({ isLoading: false });
      },

      getDashboardRoute: () => {
        const role = get().user?.role;
        switch (role) {
          case "ADMIN":
            return "/dashboard/admin";
          case "VENDOR":
            return "/dashboard/vendor";
          case "FARMER":
          case "DELIVERY":
          default:
            return "/dashboard";
        }
      },

      forgotPassword: async (phoneNumber: string) => {
        await apiClient.post("/auth/forgot-password", { phoneNumber });
      },

      resetPassword: async (phoneNumber: string, otp: string, newPassword: string) => {
        await apiClient.post("/auth/reset-password", { phoneNumber, otp, newPassword });
      },

      updateVendorProfile: async (data: {
        businessName?: string;
        gstNumber?: string;
        panNumber?: string;
      }) => {
        await apiClient.put<{
          success: boolean;
          message: string;
          data: VendorProfile;
        }>("/users/me/vendor-profile", data);
        await get().fetchFullProfile();
      },

      updateFarmerProfile: async (data: {
        village?: string;
        district?: string;
        state?: string;
        pincode?: string;
        landAreaAcres?: number;
        primaryCrops?: string[];
      }) => {
        await apiClient.put<{
          success: boolean;
          message: string;
          data: FarmerProfile;
        }>("/users/me/farmer-profile", data);
        // Refresh full user to get updated farmerProfile
        await get().fetchFullProfile();
      },

      updateProfile: async (data: {
        fullName?: string;
        email?: string;
        languagePref?: string;
      }) => {
        const response = await apiClient.put<{
          success: boolean;
          data: User;
        }>("/users/me", data);
        set({ user: response.data.data });
      },

      fetchFullProfile: async () => {
        try {
          const response = await apiClient.get<{
            success: boolean;
            data: User;
          }>("/users/me");
          set({ user: response.data.data });
        } catch {
          // Profile fetch failure is non-fatal — we still have the basic user info from login
        }
      },
    }),

    {
      name: "agri-auth-storage",
      // Only persist authentication tokens — user data will be re-fetched
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);
