"use client";

import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Footer } from "@/components/layout/Footer";
import { useUiStore } from "@/stores/uiStore";
import { TabBadgeUpdater } from "@/components/TabBadgeUpdater";
import { SearchProvider } from "@/lib/search-context";
import { cn } from "@/lib/cn";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { sidebarCollapsed } = useUiStore();

  return (
    <AuthGuard>
      <TabBadgeUpdater />
      <SearchProvider>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div
          className={cn(
            "flex flex-1 flex-col transition-all duration-300",
            sidebarCollapsed ? "lg:ml-0" : "lg:ml-0",
          )}
        >
          {/* Top navbar */}
          <Navbar />

          {/* Page content */}
          <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>

          {/* Footer */}
          <Footer />

          {/* Mobile bottom nav */}
          <MobileNav />

          {/* Spacer for mobile nav (prevents content from being hidden behind bottom bar) */}
          <div className="h-16 lg:hidden" />
        </div>
      </div>
      </SearchProvider>
    </AuthGuard>
  );
}
