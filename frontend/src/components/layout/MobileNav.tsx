"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useSidebarBadges } from "@/hooks/useSidebarBadges";
import { cn } from "@/lib/cn";
import type { UserRole } from "@/types/auth";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  User,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

interface MobileNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: UserRole[];
  badgeKey?: keyof ReturnType<typeof useSidebarBadges>;
}

const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { label: "Home",   href: "/dashboard",        icon: LayoutDashboard },
  { label: "Orders", href: "/dashboard/orders",  icon: Package,       badgeKey: "orders" },
  { label: "Khata",  href: "/dashboard/khata",   icon: BookOpen,      roles: ["FARMER", "VENDOR"] },
  { label: "Cart",   href: "/dashboard/cart",    icon: ShoppingCart },
  { label: "Profile",href: "/dashboard/profile", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const badges = useSidebarBadges();

  const visibleItems = MOBILE_NAV_ITEMS.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    if (!user?.role) return false;
    return item.roles.includes(user.role);
  });

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 block border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] lg:hidden"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-2 py-1">
        {visibleItems.map((item) => {
          const active = isActive(item.href);
          const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-[10px] font-medium transition-colors",
                active
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200",
              )}
            >
              <div
                className={cn(
                  "relative flex items-center justify-center rounded-lg p-1.5 transition-colors",
                  active && "bg-emerald-50 dark:bg-emerald-900/30",
                )}
              >
                <Icon size={20} />
                {badgeCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white ring-1 ring-white dark:ring-gray-800">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </div>
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
