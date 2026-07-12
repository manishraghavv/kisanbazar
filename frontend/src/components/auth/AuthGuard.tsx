"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: ReactNode;
  /** Optional fallback route — defaults to /auth/login */
  redirectTo?: string;
}

/**
 * Protects routes that require authentication.
 * Shows a loading spinner while auth state is being initialized.
 * Redirects to `/auth/login` (or custom `redirectTo`) if the user is not authenticated.
 */
export function AuthGuard({ children, redirectTo = "/auth/login" }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isLoading, isAuthenticated, redirectTo, router]);

  // Show nothing while loading to prevent flash of protected content
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400 dark:text-emerald-400" />
      </div>
    );
  }

  // Don't render children until authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400 dark:text-emerald-400" />
      </div>
    );
  }

  return <>{children}</>;
}
