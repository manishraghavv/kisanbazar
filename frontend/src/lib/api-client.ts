import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApiErrorResponse {
  success: false;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

interface AuthStoreActions {
  getState: () => {
    accessToken: string | null;
    refreshToken: string | null;
  };
  refreshAccessToken: () => Promise<boolean>;
  logout: () => void;
}

// ─── Lazy auth store loader ───────────────────────────────────────────────────
// Import is lazy to avoid circular dependency issues and so that the auth store
// module doesn't need to exist at the time this module is first loaded.

let _authStore: AuthStoreActions | null = null;

function getAuthStore(): AuthStoreActions | null {
  if (typeof window === "undefined") return null; // SSR guard
  if (!_authStore) {
    // Dynamic import to defer the module resolution
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _authStore = require("@/stores/authStore").useAuthStore as AuthStoreActions;
  }
  return _authStore;
}

// ─── Axios instance ───────────────────────────────────────────────────────────

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Request interceptor: attach JWT ──────────────────────────────────────────

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const authStore = getAuthStore();
    const token = authStore?.getState().accessToken;

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// ─── Response interceptor: 401 → refresh → retry ─────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only attempt refresh on 401 and if we haven't already retried
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't try to refresh if the failing request was itself a refresh call
    if (originalRequest.url?.includes("auth/refresh-token")) {
      getAuthStore()?.logout();
      return Promise.reject(error);
    }

    // If a refresh is already in progress, queue this request
    if (isRefreshing) {
      return new Promise<string | null>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        if (token && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const authStore = getAuthStore();
      if (!authStore) {
        throw new Error("Auth store not available");
      }

      const refreshed = await authStore.refreshAccessToken();

      if (refreshed) {
        const newToken = authStore.getState().accessToken;
        processQueue(null, newToken);

        if (newToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      }

      // Refresh failed — logout and reject everything
      processQueue(new Error("Refresh failed"), null);
      authStore.logout();
      return Promise.reject(error);
    } catch (refreshError) {
      processQueue(refreshError, null);
      getAuthStore()?.logout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default apiClient;
