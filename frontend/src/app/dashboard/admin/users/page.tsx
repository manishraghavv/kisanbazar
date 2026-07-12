"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminStore } from "@/stores/adminStore";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  Trash2,
  X,
  User,
  CheckCircle2,
  Ban,
  Clock,
  Eye,
} from "lucide-react";
import type { UserRole, UserStatus, UserListItem } from "@/types/auth";

const ROLE_COLORS: Record<string, string> = {
  FARMER: "bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300",
  VENDOR: "bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  ADMIN: "bg-purple-50 dark:bg-purple-900/30 dark:bg-purple-900/30 text-purple-800",
  DELIVERY: "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  ACTIVE: { bg: "bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300", icon: CheckCircle2 },
  INACTIVE: { bg: "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700", text: "text-gray-600 dark:text-gray-300 dark:text-gray-300", icon: Clock },
  BLOCKED: { bg: "bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30", text: "text-red-800", icon: Ban },
  DELETED: { bg: "bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50", text: "text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500", icon: Ban },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function UserManagementPage() {
  const { users, usersTotal, usersPage, usersTotalPages, isUsersLoading, fetchUsers, updateUserStatus, deleteUser, selectedUser, isUserLoading, fetchUserById } = useAdminStore();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState<{ id: string; name: string } | null>(null);
  const [newStatus, setNewStatus] = useState<UserStatus>("ACTIVE");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const filters: { role?: string; status?: string; search?: string } = {};
    if (roleFilter) filters.role = roleFilter;
    if (statusFilter) filters.status = statusFilter;
    if (search.trim()) filters.search = search.trim();
    fetchUsers(page, 20, filters).catch(() => toast.error("Failed to load users"));
  }, [page, roleFilter, statusFilter, search, fetchUsers]);

  useEffect(() => {
    if (selectedUserId) fetchUserById(selectedUserId).catch(() => {});
  }, [selectedUserId, fetchUserById]);

  const handleStatusUpdate = async () => {
    if (!showStatusModal) return;
    try { await updateUserStatus(showStatusModal.id, newStatus); toast.success("Status updated"); setShowStatusModal(null); }
    catch { toast.error("Failed to update status"); }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    try { await deleteUser(showDeleteConfirm.id); toast.success("User deleted"); setShowDeleteConfirm(null); }
    catch { toast.error("Failed to delete user"); }
  };

  const totalPagesNum = usersTotal > 0 ? Math.ceil(usersTotal / 20) : 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">User Management</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{usersTotal} user{usersTotal !== 1 ? "s" : ""}</p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === "Enter") setPage(1); }}
            placeholder="Search by name or phone..." className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20" />
        </div>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400">
          <option value="">All Roles</option>
          <option value="FARMER">Farmers</option>
          <option value="VENDOR">Vendors</option>
          <option value="ADMIN">Admins</option>
          <option value="DELIVERY">Delivery</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400">
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLOCKED">Blocked</option>
        </select>
      </div>

      {isUsersLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-950/30">
              <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-600 dark:bg-gray-600" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-600 dark:bg-gray-600" />
                <div className="h-3 w-1/5 animate-pulse rounded bg-gray-200 dark:bg-gray-600 dark:bg-gray-600" />
              </div>
              <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200 dark:bg-gray-600 dark:bg-gray-600" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200 dark:bg-gray-600 dark:bg-gray-600" />
              <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-600 dark:bg-gray-600" />
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 py-16 shadow-sm dark:shadow-gray-950/30">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
            <User size={28} className="text-gray-300" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">No users found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 dark:border-gray-700 bg-gray-50/80">
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">User</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Role</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Status</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Joined</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => {
                const statusStyle = STATUS_STYLES[u.status] ?? STATUS_STYLES.INACTIVE;
                const StatusIcon = statusStyle.icon;
                return (
                  <tr key={u.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50/80">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-[11px] font-bold text-white shadow-sm dark:shadow-gray-950/30">
                          {u.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{u.fullName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 truncate">{u.phoneNumber}{u.email ? ` · ${u.email}` : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[u.role] ?? "bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 dark:text-gray-200"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                        <StatusIcon size={10} />
                        {u.status.charAt(0) + u.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setSelectedUserId(u.id)}
                          className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400 active:scale-90"
                          title="View details">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => { setShowStatusModal({ id: u.id, name: u.fullName }); setNewStatus(u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"); }}
                          className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-all hover:bg-amber-50 dark:bg-amber-900/30 hover:text-amber-700 active:scale-90"
                          title="Change status">
                          <Shield size={14} />
                        </button>
                        <button onClick={() => setShowDeleteConfirm({ id: u.id, name: u.fullName })}
                          className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-all hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 hover:text-red-600 active:scale-90"
                          title="Delete user">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPagesNum > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
            className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"><ChevronLeft size={16} /></button>
          {Array.from({ length: Math.min(totalPagesNum, 5) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, totalPagesNum - 4));
            const p = start + i;
            if (p > totalPagesNum) return null;
            return <button key={p} onClick={() => setPage(p)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold ${p === page ? "bg-emerald-700 text-white" : "text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"}`}>{p}</button>;
          })}
          <button onClick={() => setPage(p => Math.min(totalPagesNum, p+1))} disabled={page >= totalPagesNum}
            className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"><ChevronRight size={16} /></button>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setSelectedUserId(null)}>
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50" onClick={e => e.stopPropagation()}>
            {isUserLoading ? <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-emerald-700 dark:text-emerald-400" /></div>
            : selectedUser ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{selectedUser.fullName}</h3>
                  <button onClick={() => setSelectedUserId(null)} className="rounded-lg p-1 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"><X size={18} /></button>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">Phone</span><span className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{selectedUser.phoneNumber}</span></div>
                  <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">Email</span><span className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{selectedUser.email ?? "—"}</span></div>
                  <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">Role</span><span className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{selectedUser.role}</span></div>
                  <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">Status</span><span className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{selectedUser.status}</span></div>
                  <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">Verified</span><span className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{selectedUser.isPhoneVerified ? "✅" : "❌"}</span></div>
                  <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">Joined</span><span className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatDate(selectedUser.createdAt)}</span></div>
                  {selectedUser.lastLoginAt && <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">Last Login</span><span className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatDate(selectedUser.lastLoginAt)}</span></div>}
                  {selectedUser.vendorProfile && <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">Business</span><span className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{selectedUser.vendorProfile.businessName}</span></div>}
                </div>
              </>
            ) : <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">User not found</p>}
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Update Status</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">Change status for {showStatusModal.name}</p>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value as UserStatus)}
              className="mt-4 w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLOCKED">Blocked</option>
            </select>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowStatusModal(null)} className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50">Cancel</button>
              <button onClick={handleStatusUpdate} className="flex-1 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-800">Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30"><Trash2 size={24} className="text-red-600 dark:text-red-400" /></div>
            <h3 className="text-center text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Delete User?</h3>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">This will soft-delete {showDeleteConfirm.name}.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50">Cancel</button>
              <button onClick={handleDelete} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
                <Trash2 size={16} />Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
