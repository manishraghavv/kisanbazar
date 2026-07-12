"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useUiStore } from "@/stores/uiStore";
import { useSearchContext } from "@/lib/search-context";
import { cn } from "@/lib/cn";
import {
  Menu,
  Search,
  Bell,
  BellDot,
  LogOut,
  User,
  Settings,
  ChevronDown,
  Sprout,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import type { Theme } from "@/stores/uiStore";

export function Navbar() {
  const { user, logout } = useAuthStore();
  const { setMobileSidebarOpen, theme, resolvedTheme, toggleTheme } = useUiStore();
  const router = useRouter();
  const pathname = usePathname();

  const { searchQuery, setSearchQuery } = useSearchContext();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fetch notification badge count on mount and periodically
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const count = await useNotificationStore.getState().fetchUnreadCount();
        setUnreadCount(count);
      } catch { /* silent */ }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60_000); // Refresh every 60s
    return () => clearInterval(interval);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
    toast.success("Logged out successfully");
    router.push("/auth/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 shadow-sm lg:px-6 transition-colors duration-200">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Brand (mobile only, when sidebar is hidden) */}
      <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700">
          <Sprout size={16} className="text-white" />
        </div>
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">Kisaan Bazaar</span>
      </Link>

      {/* Search bar — filters products when on /products, navigates there otherwise */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = searchQuery.trim();
          if (pathname !== "/products") {
            router.push(trimmed ? `/products?search=${encodeURIComponent(trimmed)}` : "/products");
          }
        }}
        className="mx-auto hidden max-w-md flex-1 md:block"
      >
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder={
              pathname === "/products"
                ? "Filter products by name, crop, or brand..."
                : "Search products..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 py-2 pl-9 pr-4 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors focus:border-emerald-500 focus:bg-white dark:focus:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </form>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Theme toggle with dropdown */}
        <div className="relative">
          <button
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            title={`Theme: ${theme === "system" ? "System (" + resolvedTheme + ")" : theme}`}
          >
            {theme === "light" ? (
              <Sun size={18} />
            ) : theme === "dark" ? (
              <Moon size={18} />
            ) : (
              <Monitor size={18} />
            )}
          </button>
        </div>


        {/* Notification bell */}
        <button
          onClick={() => router.push("/dashboard/notifications")}
          className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          {unreadCount > 0 ? <BellDot size={20} /> : <Bell size={20} />}
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 py-0.5 text-[9px] font-bold text-white ring-2 ring-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* User menu */}
        {user && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium leading-tight text-gray-900 dark:text-gray-100">
                  {user.fullName}
                </p>
                <p className="text-xs leading-tight text-gray-500 dark:text-gray-400">
                  {user.role}
                </p>
              </div>
              <ChevronDown
                size={14}
                className={cn(
                  "hidden text-gray-400 transition-transform md:block",
                  showUserMenu && "rotate-180",
                )}
              />
            </button>

            {/* Dropdown menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg">
                <div className="border-b border-gray-100 dark:border-gray-700 px-4 py-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user.fullName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user.phoneNumber}</p>
                </div>                  <Link
                  href="/dashboard/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <User size={16} className="text-gray-400 dark:text-gray-500" />
                  My Profile
                </Link>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Settings size={16} className="text-gray-400" />
                  Settings
                </Link>

                <div className="border-t border-gray-100 dark:border-gray-700" />

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={16} />
                  Log Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
