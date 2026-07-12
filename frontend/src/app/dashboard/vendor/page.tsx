"use client";

import Link from "next/link";
import { RoleGuard } from "@/components/auth/RoleGuard";
import {
  PackageSearch,
  Warehouse,
  Truck,
  Percent,
  Banknote,
  BarChart3,
  Building2,
  LifeBuoy,
  BookOpen,
  TrendingUp,
} from "lucide-react";

const VENDOR_SECTIONS = [
  { label: "My Products", href: "/dashboard/vendor/products", icon: PackageSearch, desc: "Manage your product listings" },
  { label: "Inventory", href: "/dashboard/vendor/inventory", icon: Warehouse, desc: "Track stock levels and movements" },
  { label: "Incoming Orders", href: "/dashboard/vendor/orders", icon: Truck, desc: "Fulfil customer and farmer orders" },
  { label: "Commissions", href: "/dashboard/vendor/commissions", icon: Percent, desc: "View platform commission breakdown" },
  { label: "Settlements", href: "/dashboard/vendor/settlements", icon: Banknote, desc: "Payout history and pending settlements" },
  { label: "Analytics", href: "/dashboard/vendor/analytics", icon: TrendingUp, desc: "Sales charts, revenue, and top products" },
  { label: "Khata Analytics", href: "/dashboard/vendor/khata-analytics", icon: BarChart3, desc: "Credit ledger performance" },
  { label: "KhataBook", href: "/dashboard/khata", icon: BookOpen, desc: "Manage farmer credit accounts" },
  { label: "Enterprise", href: "/dashboard/vendor/enterprise", icon: Building2, desc: "Enterprise tier and features" },
  { label: "Support", href: "/dashboard/support", icon: LifeBuoy, desc: "Raise and track support tickets" },
];

export default function VendorDashboardPage() {
  return (
    <RoleGuard allowedRoles={["VENDOR"]}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Vendor Dashboard</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-300 dark:text-gray-500">Manage your store, inventory, and credit accounts</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VENDOR_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="group flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30 transition-all hover:border-emerald-200 dark:hover:border-emerald-700 hover:shadow-md dark:shadow-gray-950/30"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30 transition-colors group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 dark:hover:bg-emerald-900/50">
                  <Icon size={20} className="text-emerald-700 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-300 dark:text-emerald-400 dark:hover:text-emerald-300 dark:text-emerald-400">
                    {section.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{section.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </RoleGuard>
  );
}
