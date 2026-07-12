import type { UserRole } from "@/types/auth";
import type { LucideIcon } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NavItem {
  /** Display label */
  label: string;
  /** Route path */
  href: string;
  /** Lucide icon name (or "separator" for a divider) */
  icon: LucideIcon | "separator";
  /** Roles that can see this item. Empty = visible to all authenticated users. */
  roles?: UserRole[];
  /** Nested children (for dropdowns in sidebar) */
  children?: NavItem[];
  /** Badge count (e.g. notification count) */
  badge?: number;
}

// ─── Role-based navigation ────────────────────────────────────────────────────

export const navigationConfig: NavItem[] = [
  // ── All authenticated users ─────────────────────────────────────────────
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard" as unknown as LucideIcon,
  },
  {
    label: "Browse Products",
    href: "/products",
    icon: "PackageSearch" as unknown as LucideIcon,
  },
  {
    label: "Profile",
    href: "/dashboard/profile",
    icon: "User" as unknown as LucideIcon,
  },
  {
    label: "Addresses",
    href: "/dashboard/addresses",
    icon: "MapPin" as unknown as LucideIcon,
  },
  {
    label: "Cart",
    href: "/dashboard/cart",
    icon: "ShoppingCart" as unknown as LucideIcon,
  },
  {
    label: "Wallet",
    href: "/dashboard/wallet",
    icon: "Wallet" as unknown as LucideIcon,
  },
  {
    label: "Wishlist",
    href: "/dashboard/wishlist",
    icon: "Heart" as unknown as LucideIcon,
  },
  {
    label: "Orders",
    href: "/dashboard/orders",
    icon: "Package" as unknown as LucideIcon,
  },
  {
    label: "Payments",
    href: "/dashboard/payments",
    icon: "CreditCard" as unknown as LucideIcon,
  },
  { label: "separator", href: "", icon: "separator" as unknown as LucideIcon },

  // ── KhataBook (Farmers & Vendors) ─────────────────────────────────────────
  {
    label: "KhataBook",
    href: "/dashboard/khata",
    icon: "BookOpen" as unknown as LucideIcon,
    roles: ["FARMER", "VENDOR"],
  },
  {
    label: "Khata Reports",
    href: "/dashboard/khata/reports",
    icon: "BarChart3" as unknown as LucideIcon,
    roles: ["VENDOR", "ADMIN"],
  },
  {
    label: "Khata Dashboard",
    href: "/dashboard/khata/farmer-dashboard",
    icon: "BarChart3" as unknown as LucideIcon,
    roles: ["FARMER"],
  },
  {
    label: "Support",
    href: "/dashboard/support",
    icon: "LifeBuoy" as unknown as LucideIcon,
    roles: ["FARMER"],
  },
  { label: "separator", href: "", icon: "separator" as unknown as LucideIcon, roles: ["FARMER", "VENDOR"] },

  // ── Vendor-specific ─────────────────────────────────────────────────────────
  {
    label: "My Products",
    href: "/dashboard/vendor/products",
    icon: "PackageSearch" as unknown as LucideIcon,
    roles: ["VENDOR"],
  },
  {
    label: "Inventory",
    href: "/dashboard/vendor/inventory",
    icon: "Warehouse" as unknown as LucideIcon,
    roles: ["VENDOR"],
  },
  {
    label: "Incoming Orders",
    href: "/dashboard/vendor/orders",
    icon: "Truck" as unknown as LucideIcon,
    roles: ["VENDOR"],
  },
  {
    label: "Commissions",
    href: "/dashboard/vendor/commissions",
    icon: "Percent" as unknown as LucideIcon,
    roles: ["VENDOR"],
  },
  {
    label: "Settlements",
    href: "/dashboard/vendor/settlements",
    icon: "Banknote" as unknown as LucideIcon,
    roles: ["VENDOR"],
  },
  {
    label: "Khata Analytics",
    href: "/dashboard/vendor/khata-analytics",
    icon: "BarChart3" as unknown as LucideIcon,
    roles: ["VENDOR"],
  },
  {
    label: "Enterprise",
    href: "/dashboard/vendor/enterprise",
    icon: "Building2" as unknown as LucideIcon,
    roles: ["VENDOR"],
  },
  {
    label: "Support Tickets",
    href: "/dashboard/support",
    icon: "LifeBuoy" as unknown as LucideIcon,
    roles: ["VENDOR"],
  },
  { label: "separator", href: "", icon: "separator" as unknown as LucideIcon, roles: ["VENDOR"] },

  // ── Admin-specific ───────────────────────────────────────────────────────────
  {
    label: "User Management",
    href: "/dashboard/admin/users",
    icon: "Users" as unknown as LucideIcon,
    roles: ["ADMIN"],
  },
  {
    label: "Categories",
    href: "/dashboard/admin/categories",
    icon: "FolderTree" as unknown as LucideIcon,
    roles: ["ADMIN"],
  },
  {
    label: "Product Moderation",
    href: "/dashboard/admin/products/moderation",
    icon: "ShieldCheck" as unknown as LucideIcon,
    roles: ["ADMIN"],
  },
  {
    label: "Coupons",
    href: "/dashboard/admin/coupons",
    icon: "Tag" as unknown as LucideIcon,
    roles: ["ADMIN"],
  },
  {
    label: "Settlements",
    href: "/dashboard/admin/settlements",
    icon: "Landmark" as unknown as LucideIcon,
    roles: ["ADMIN"],
  },
  {
    label: "Khata Overview",
    href: "/dashboard/admin/khata",
    icon: "BookOpen" as unknown as LucideIcon,
    roles: ["ADMIN"],
  },
  {
    label: "Industries",
    href: "/dashboard/admin/industries",
    icon: "Factory" as unknown as LucideIcon,
    roles: ["ADMIN"],
  },
  {
    label: "Enterprise Tiers",
    href: "/dashboard/admin/tiers",
    icon: "Layers" as unknown as LucideIcon,
    roles: ["ADMIN"],
  },
  {
    label: "Support Tickets",
    href: "/dashboard/admin/support",
    icon: "Headphones" as unknown as LucideIcon,
    roles: ["ADMIN"],
  },
  {
    label: "Audit Logs",
    href: "/dashboard/admin/audit-logs",
    icon: "ScrollText" as unknown as LucideIcon,
    roles: ["ADMIN"],
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: "BarChart3" as unknown as LucideIcon,
    roles: ["ADMIN"],
  },
  {
    label: "Market Intelligence",
    href: "/dashboard/reports/market-intelligence",
    icon: "TrendingUp" as unknown as LucideIcon,
    roles: ["VENDOR", "ADMIN"],
  },
  { label: "separator", href: "", icon: "separator" as unknown as LucideIcon, roles: ["ADMIN"] },

  // ── All authenticated (bottom section) ───────────────────────────────────────
  {
    label: "Notifications",
    href: "/dashboard/notifications",
    icon: "Bell" as unknown as LucideIcon,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: "Settings" as unknown as LucideIcon,
  },
];

/**
 * Filters navigation items based on user role.
 * Items without a role restriction are visible to all.
 * "separator" items are filtered by role too.
 */
export function getNavItemsForRole(role?: UserRole): NavItem[] {
  return navigationConfig.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    if (!role) return false;
    return item.roles.includes(role);
  });
}
