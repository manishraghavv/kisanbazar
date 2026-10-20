"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useDashboardStore } from "@/stores/dashboardStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { toast } from "sonner";
import { User, MapPin, ShoppingCart, Heart, Package, ShoppingBag, Bell, IndianRupee, Users, TrendingUp, BookOpen } from "lucide-react";
import Link from "next/link";

// ─── Quick link cards for all created pages ──────────────────────────────────

const QUICK_LINKS = [
  { label: "Browse Products", href: "/products", icon: ShoppingBag, desc: "Explore agricultural supplies" },
  { label: "Shopping Cart", href: "/dashboard/cart", icon: ShoppingCart, desc: "View items ready to order" },
  { label: "My Orders", href: "/dashboard/orders", icon: Package, desc: "Track order status" },
  { label: "Wishlist", href: "/dashboard/wishlist", icon: Heart, desc: "Saved products" },
  { label: "My Profile", href: "/dashboard/profile", icon: User, desc: "Manage personal info" },
  { label: "Addresses", href: "/dashboard/addresses", icon: MapPin, desc: "Shipping addresses" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatCompact(num: number) {
  if (num >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

const STAT_CARD_BG: Record<string, string> = {
  "bg-emerald-600": "from-emerald-600 to-emerald-500",
  "bg-blue-600": "from-blue-600 to-blue-500",
  "bg-amber-600": "from-amber-600 to-amber-500",
  "bg-purple-600": "from-purple-600 to-purple-500",
};

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  href?: string;
}) {
  const gradient = STAT_CARD_BG[color] ?? "from-gray-600 to-gray-500";

  const content = (
    <div className="group rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} shadow-sm transition-transform duration-200 group-hover:scale-110`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardHomePage() {
  const { user } = useAuthStore();
  const { vendorData, adminData, isLoading: dashLoading, fetchVendorDashboard, fetchAdminDashboard } = useDashboardStore();
  const { unreadCount, fetchUnreadCount } = useNotificationStore();

  // Fetch role-specific data on mount
  useEffect(() => {
    if (user?.role === "VENDOR") {
      fetchVendorDashboard().catch(() => toast.error("Failed to load dashboard data"));
    } else if (user?.role === "ADMIN") {
      fetchAdminDashboard().catch(() => toast.error("Failed to load dashboard data"));
    }
    fetchUnreadCount().catch(() => {});
  }, [user?.role, fetchVendorDashboard, fetchAdminDashboard, fetchUnreadCount]);

  const initials = (user?.fullName ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const role = user?.role;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Welcome section */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-xl font-bold text-white shadow">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Welcome, {user?.fullName ?? "User"}!
            </h1>
            <p className="mt-0.5 text-gray-600 dark:text-gray-400">
              Here&apos;s an overview of your {role?.toLowerCase() ?? "account"} dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Stats Grid */}
      {role === "VENDOR" && vendorData && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Sales"
            value={formatCurrency(vendorData.totalSales)}
            icon={IndianRupee}
            color="bg-emerald-600"
            href="/dashboard/vendor/orders"
          />
          <StatCard
            label="Orders"
            value={vendorData.totalOrders}
            icon={Package}
            color="bg-blue-600"
            href="/dashboard/vendor/orders"
          />
          <StatCard
            label="Khata Outstanding"
            value={formatCurrency(vendorData.khataSummary.totalOutstanding)}
            icon={BookOpen}
            color="bg-amber-600"
            href="/dashboard/khata"
          />
          <StatCard
            label="Commission Earned"
            value={formatCurrency(vendorData.commissions.totalCommissionAmount)}
            icon={TrendingUp}
            color="bg-purple-600"
            href="/dashboard/vendor/commissions"
          />
        </div>
      )}

      {role === "ADMIN" && adminData && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="GMV"
            value={formatCurrency(adminData.gmv)}
            icon={IndianRupee}
            color="bg-emerald-600"
          />
          <StatCard
            label="Platform Revenue"
            value={formatCurrency(adminData.platformRevenue)}
            icon={TrendingUp}
            color="bg-blue-600"
          />
          <StatCard
            label="Active Users"
            value={formatCompact(adminData.users.total)}
            icon={Users}
            color="bg-purple-600"
            href="/dashboard/admin/users"
          />
          <StatCard
            label="Orders Delivered"
            value={`${adminData.orders.delivered} (${adminData.orders.conversionRate}%)`}
            icon={Package}
            color="bg-emerald-600"
          />
        </div>
      )}

      {/* Farmer / fallback stats */}
      {(role === "FARMER" || !role || (role === "VENDOR" && !vendorData)) && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Role" value={role ?? "—"} icon={User} color="bg-emerald-600" />
          <StatCard label="Phone" value={user?.phoneNumber ?? "—"} icon={User} color="bg-blue-600" />
          <StatCard
            label="Account Status"
            value={user?.isPhoneVerified ? "Verified" : "Unverified"}
            icon={User}
            color="bg-amber-600"
          />
          <StatCard
            label="Notifications"
            value={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            icon={Bell}
            color="bg-purple-600"
            href="/dashboard/notifications"
          />
        </div>
      )}

      {/* Quick links grid */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <div className="h-1 w-6 rounded-full bg-emerald-600" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Quick Actions</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 transition-all duration-200 hover:border-emerald-200 dark:hover:border-emerald-700 hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/30 transition-all duration-200 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 group-hover:scale-105">
                  <Icon size={22} className="text-emerald-700 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-400">
                    {link.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{link.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Role-specific sections */}
      {role === "VENDOR" && (
        <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-1 w-6 rounded-full bg-emerald-600" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Vendor Tools</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/vendor/products" className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:scale-95">
              My Products
            </Link>
            <Link href="/dashboard/vendor/orders" className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:scale-95">
              Incoming Orders
            </Link>
            <Link href="/dashboard/vendor/inventory" className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:scale-95">
              Inventory
            </Link>
            <Link href="/dashboard/vendor/commissions" className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:scale-95">
              Commissions
            </Link>
            <Link href="/dashboard/support" className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:scale-95">
              Support
            </Link>
          </div>
        </div>
      )}

      {role === "ADMIN" && adminData && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Users Overview */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-1 w-6 rounded-full bg-emerald-600" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Users Overview</h2>
            </div>
            <div className="space-y-2">
              {[
                { label: "Total Active", value: adminData.users.total, color: "text-gray-900 dark:text-gray-100" },
                { label: "Farmers", value: adminData.users.farmers, color: "text-gray-900 dark:text-gray-100" },
                { label: "Vendors", value: adminData.users.vendors, color: "text-gray-900 dark:text-gray-100" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 px-4 py-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{row.label}</span>
                  <span className={`text-sm font-bold ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Khata & Orders */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-1 w-6 rounded-full bg-emerald-600" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Khata &amp; Orders</h2>
            </div>
            <div className="space-y-2">
              {[
                { label: "Khata Accounts", value: adminData.khata.totalAccounts, color: "text-gray-900 dark:text-gray-100" },
                { label: "Overdue Rate", value: `${adminData.khata.defaultRate}%`, color: "text-red-600" },
                { label: "Total Orders", value: adminData.orders.total, color: "text-gray-900 dark:text-gray-100" },
                { label: "Conversion", value: `${adminData.orders.conversionRate}%`, color: "text-emerald-600" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 px-4 py-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{row.label}</span>
                  <span className={`text-sm font-bold ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {role === "ADMIN" && adminData?.recentRegistrations && (
        <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-1 w-6 rounded-full bg-emerald-600" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Recent Registrations</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {adminData.recentRegistrations.slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2.5 transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-700/30 px-2 -mx-2 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-[11px] font-bold text-white shadow-sm">
                    {u.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.fullName}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{u.role}</p>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                  {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
            {adminData.recentRegistrations.length > 5 && (
              <Link href="/dashboard/admin/users" className="mt-3 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/30">
                View all users
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Loading state for dashboard data */}
      {dashLoading && !vendorData && !adminData && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">            {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="h-3 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-9 w-9 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
              </div>
              <div className="mt-3 h-8 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
