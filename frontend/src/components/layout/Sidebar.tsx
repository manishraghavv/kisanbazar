"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sprout,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  X,
  LayoutDashboard,
  User,
  MapPin,
  ShoppingCart,
  Heart,
  Package,
  CreditCard,
  Wallet,
  BookOpen,
  PackageSearch,
  Warehouse,
  Truck,
  Percent,
  Banknote,
  Building2,
  LifeBuoy,
  Users,
  FolderTree,
  ShieldCheck,
  Tag,
  Landmark,
  Factory,
  Layers,
  Headphones,
  ScrollText,
  BarChart3,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { getNavItemsForRole, type NavItem } from "@/config/navigation";
import { useSidebarBadges } from "@/hooks/useSidebarBadges";
import { cn } from "@/lib/cn";

// ─── Icon map ────────────────────────────────────────────────────────────────

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  User,
  MapPin,
  ShoppingCart,
  Heart,
  Package,
  CreditCard,
  Wallet,
  BookOpen,
  PackageSearch,
  Warehouse,
  Truck,
  Percent,
  Banknote,
  Building2,
  LifeBuoy,
  Users,
  FolderTree,
  ShieldCheck,
  Tag,
  Landmark,
  Factory,
  Layers,
  Headphones,
  ScrollText,
  BarChart3,
  Bell,
  Settings,
  TrendingUp,
};

// ─── Single nav item ──────────────────────────────────────────────────────────

function NavItemLink({
  item,
  collapsed,
  active,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
  onNavigate?: () => void;
}) {
  // Resolve icon: the config stores icon name strings, look them up in iconMap
  const iconName =
    typeof item.icon === "string"
      ? item.icon
      : item.icon.displayName ?? item.icon.name;
  const Icon = item.icon === ("separator" as unknown) ? null : (iconMap[iconName as string] ?? null);

  if (item.icon === ("separator" as unknown as LucideIcon)) {
    return        <div className="my-2 border-t border-gray-200 dark:border-gray-700" />;
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
        active
          ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100",
      )}
      title={collapsed ? item.label : undefined}
    >
      {Icon && (
        <Icon
          size={20}
          className={cn(
            "shrink-0",
            active ? "text-emerald-700 dark:text-emerald-400" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300",
          )}
        />
      )}
      {!collapsed && <span>{item.label}</span>}
      {!collapsed && item.badge !== undefined && item.badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
    </Link>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { sidebarCollapsed, mobileSidebarOpen, toggleSidebar, setMobileSidebarOpen } = useUiStore();
  const badges = useSidebarBadges();

  const navItems = getNavItemsForRole(user?.role).map((item) => {
    // Apply dynamic badges from the badges hook
    if (item.href === "/dashboard/notifications" && badges.notifications > 0) {
      return { ...item, badge: badges.notifications };
    }
    return item;
  });
  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-300",
          // Desktop
          "lg:static lg:z-auto",
          sidebarCollapsed ? "lg:w-[68px]" : "lg:w-[280px]",
          // Mobile overlay
          mobileSidebarOpen
            ? "translate-x-0 shadow-2xl"
            : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo area */}
        <div
          className={cn(
            "flex items-center border-b border-gray-200 dark:border-gray-700 px-4",
            sidebarCollapsed ? "justify-center py-4" : "justify-between py-3",
          )}
        >
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 shadow">
              <Sprout size={18} className="text-white" />
            </div>
            {!sidebarCollapsed && (
              <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                Kisaan Bazaar
              </span>
            )}
          </Link>

          {!sidebarCollapsed && (
            <>
              {/* Close button (mobile) */}
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
              >
                <X size={18} />
              </button>
              {/* Collapse button (desktop) */}
              <button
                onClick={toggleSidebar}
                className="hidden h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:flex"
              >
                <ChevronLeft size={18} />
              </button>
            </>
          )}
        </div>

        {/* Collapsed expand button */}
        {sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center border-b border-gray-200 py-3 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          >
            <ChevronRight size={18} />
          </button>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-0.5">
            {navItems.map((item, index) => (
              <NavItemLink
                key={`${item.href}-${item.label}-${index}`}
                item={item}
                collapsed={sidebarCollapsed}
                active={isActive(item.href)}
                onNavigate={() => setMobileSidebarOpen(false)}
              />
            ))}
          </div>
        </nav>

        {/* User info (collapsed) */}
        {sidebarCollapsed && user && (
          <div className="border-t border-gray-200 p-3 text-center">
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* User info (expanded) */}
        {!sidebarCollapsed && user && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {user.fullName}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
