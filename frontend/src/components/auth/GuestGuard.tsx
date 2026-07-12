"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { Loader2 } from "lucide-react";

interface GuestGuardProps {
  children: ReactNode;
}

/**
 * Prevents authenticated users from accessing auth pages (login, register, etc.).
 * Redirects to the role-appropriate dashboard if the user is already signed in.
 * Shows a loading spinner while auth state is being initialized.
 */
export function GuestGuard({ children }: GuestGuardProps) {
  const { isAuthenticated, isLoading, getDashboardRoute } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(getDashboardRoute());
    }
  }, [isLoading, isAuthenticated, getDashboardRoute, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400 dark:text-emerald-400" />
      </div>
    );
  }

  // Don't render children while redirecting
  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400 dark:text-emerald-400" />
      </div>
    );
  }

  return <>{children}</>;
}
