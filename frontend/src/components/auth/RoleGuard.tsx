"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import type { UserRole } from "@/types/auth";
import { ShieldOff, Loader2 } from "lucide-react";

interface RoleGuardProps {
  children: ReactNode;
  /** List of roles allowed to access this route */
  allowedRoles: UserRole[];
  /** Fallback redirect when user doesn't have the required role — defaults to /dashboard */
  fallbackRoute?: string;
}

/**
 * Restricts route access based on user role.
 * - Shows a loading spinner while auth state is initialising.
 * - Redirects to login if the user is not authenticated.
 * - Redirects to `fallbackRoute` if the user's role is not in `allowedRoles`.
 * - Shows "Access Denied" only as a fallback if the redirect doesn't complete.
 */
export function RoleGuard({
  children,
  allowedRoles,
  fallbackRoute = "/dashboard",
}: RoleGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const isRedirecting = useRef(false);

  const hasRequiredRole = user?.role ? allowedRoles.includes(user.role) : false;

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      isRedirecting.current = true;
      router.replace("/auth/login");
      return;
    }

    if (!hasRequiredRole) {
      isRedirecting.current = true;
      router.replace(fallbackRoute);
    }
  }, [isLoading, isAuthenticated, hasRequiredRole, router, fallbackRoute]);

  // While loading, not authenticated, or unauthorised — show spinner
  // (redirect is triggered via the effect above)
  if (isLoading || !isAuthenticated || (isRedirecting.current && !hasRequiredRole)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400 dark:text-emerald-400" />
      </div>
    );
  }

  // Persistent fallback if user somehow stays on the page after failed redirect
  if (!hasRequiredRole) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <ShieldOff className="h-12 w-12 text-red-500 dark:text-red-400 dark:text-red-400" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 dark:text-gray-200">Access Denied</h1>
        <p className="text-center text-gray-600 dark:text-gray-300 dark:text-gray-300">
          You do not have the required permissions to access this page.
          <br />
          Your role <strong>({user?.role ?? "N/A"})</strong> is not in the
          allowed roles: <strong>{allowedRoles.join(", ")}</strong>.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
