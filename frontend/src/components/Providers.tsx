"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useAuthStore } from "@/stores/authStore";

/**
 * Wraps the app with all global providers:
 * - React Query for server state management
 * - Sonner toast notifications
 * - Auth initialization (silent token refresh on mount)
 */
export function Providers({ children }: { children: ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);

  // Lazy-init in state to avoid cross-request leaks in Next.js SSR
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30s before data is considered stale
            retry: 1, // Retry once on failure
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
        }}
      />
    </QueryClientProvider>
  );
}
