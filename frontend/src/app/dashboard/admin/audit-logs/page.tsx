"use client";

import { useEffect, useState } from "react";
import { useAdminStore } from "@/stores/adminStore";
import { toast } from "sonner";
import {
  ScrollText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Clock,
} from "lucide-react";

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30",
  UPDATE: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 dark:bg-blue-900/30",
  DELETE: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30",
  LOGIN: "text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 dark:bg-purple-900/30",
  APPROVE: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30",
  REJECT: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30",
  SUBMIT: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30",
};

function ActionBadge({ action }: { action: string }) {
  const colors = ACTION_COLORS[action.toUpperCase()] ?? "text-gray-700 dark:text-gray-200 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 dark:bg-gray-700";
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${colors}`}>{action}</span>;
}

export default function AuditLogsPage() {
  const { auditLogs, auditLogsTotal, auditLogsPage, auditLogsTotalPages, isAuditLogsLoading, fetchAuditLogs } = useAdminStore();
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const filters: { entityType?: string; action?: string } = {};
    if (entityFilter) filters.entityType = entityFilter;
    if (actionFilter) filters.action = actionFilter;
    fetchAuditLogs(page, 20, filters).catch(() => toast.error("Failed to load audit logs"));
  }, [page, entityFilter, actionFilter, fetchAuditLogs]);

  const hasFilters = !!entityFilter || !!actionFilter;
  const totalPagesNum = Math.ceil(auditLogsTotal / 20);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Audit Logs</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{auditLogsTotal} log{auditLogsTotal !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all ${
            showFilters || hasFilters ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "border-gray-300 dark:border-gray-600 dark:border-gray-600 text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50"
          }`}>
          <Filter size={15} />Filters{hasFilters && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 text-[10px] font-bold text-white">{(entityFilter ? 1 : 0) + (actionFilter ? 1 : 0)}</span>}
        </button>
      </div>

      {showFilters && (
        <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Entity Type</label>
              <select value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400">
                <option value="">All</option>
                <option value="USER">User</option>
                <option value="ORDER">Order</option>
                <option value="PRODUCT">Product</option>
                <option value="KHATA_ACCOUNT">Khata Account</option>
                <option value="PAYMENT">Payment</option>
                <option value="SUPPORT_TICKET">Support Ticket</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Action</label>
              <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400">
                <option value="">All</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="LOGIN">Login</option>
                <option value="APPROVE">Approve</option>
                <option value="REJECT">Reject</option>
                <option value="SUBMIT">Submit</option>
              </select>
            </div>
            {hasFilters && (
              <div className="flex items-end">
                <button onClick={() => { setEntityFilter(""); setActionFilter(""); setPage(1); }}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700">
                  <X size={12} /> Clear
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isAuditLogsLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" /></div>
      ) : auditLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30"><ScrollText size={36} className="text-emerald-300" /></div>
          <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">No audit logs</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Logs will appear as actions are performed</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Entity</th>
                <th className="px-4 py-3 text-left">Entity ID</th>
                <th className="px-4 py-3 text-left">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 dark:divide-gray-700">
              {auditLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1"><Clock size={11} />{formatDateTime(log.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3"><ActionBadge action={log.action} /></td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{log.entityType}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-mono max-w-[160px] truncate">{log.entityId}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">{log.actorRole ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPagesNum > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1} className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"><ChevronLeft size={16} /></button>
          {Array.from({ length: Math.min(totalPagesNum, 5) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, totalPagesNum - 4));
            const p = start + i;
            if (p > totalPagesNum) return null;
            return <button key={p} onClick={() => setPage(p)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold ${p === page ? "bg-emerald-700 text-white" : "text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"}`}>{p}</button>;
          })}
          <button onClick={() => setPage(p => Math.min(totalPagesNum, p+1))} disabled={page >= totalPagesNum} className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
}
