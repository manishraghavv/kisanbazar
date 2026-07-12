"use client";

import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SearchProvider } from "@/lib/search-context";

/**
 * Shared layout for public catalog pages (products, categories).
 * Provides the Navbar (with user menu, search bar, notification bell)
 * without the dashboard sidebar.
 */
export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <SearchProvider>
      <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
        {/* Top navbar with user menu & search */}
        <Navbar />
        {/* Page content */}
        <main className="flex-1">{children}</main>
        {/* Footer */}
        <Footer />
      </div>
    </SearchProvider>
  );
}
