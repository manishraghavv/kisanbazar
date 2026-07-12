"use client";

import Link from "next/link";
import { RoleGuard } from "@/components/auth/RoleGuard";
import {
  Users,
  FolderTree,
  ShieldCheck,
  Tag,
  BookOpen,
  ScrollText,
  BarChart3,
  Headphones,
  Landmark,
} from "lucide-react";

const ADMIN_SECTIONS = [
  { label: "User Management", href: "/dashboard/admin/users", icon: Users, desc: "Manage farmers, vendors, and delivery agents" },
  { label: "Categories", href: "/dashboard/admin/categories", icon: FolderTree, desc: "Manage product categories" },
  { label: "Product Moderation", href: "/dashboard/admin/products/moderation", icon: ShieldCheck, desc: "Review and approve vendor products" },
  { label: "Coupons", href: "/dashboard/admin/coupons", icon: Tag, desc: "Create and manage discount coupons" },
  { label: "Settlements", href: "/dashboard/admin/settlements", icon: Landmark, desc: "Vendor payout management" },
  { label: "Khata Overview", href: "/dashboard/admin/khata", icon: BookOpen, desc: "Platform-wide credit ledger overview" },
  { label: "Audit Logs", href: "/dashboard/admin/audit-logs", icon: ScrollText, desc: "System activity and change history" },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3, desc: "Platform analytics and reports" },
  { label: "Support Tickets", href: "/dashboard/admin/support", icon: Headphones, desc: "Customer support queue" },
];

export default function AdminDashboardPage() {
  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="h-1 w-6 rounded-full bg-emerald-600" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 dark:text-gray-100">Admin Dashboard</h1>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Platform management and oversight</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="group flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 dark:hover:border-emerald-700 hover:shadow-md dark:shadow-gray-950/30 active:scale-95"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-sm dark:shadow-gray-950/30 transition-all duration-200 group-hover:scale-105">
                  <Icon size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 transition-colors group-hover:text-emerald-800 dark:hover:text-emerald-300">
                    {section.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{section.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </RoleGuard>
  );
}
