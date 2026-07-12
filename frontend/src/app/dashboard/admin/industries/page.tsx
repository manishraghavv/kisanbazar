"use client";

import { useEffect, useState, useCallback } from "react";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import {
  Factory,
  Loader2,
  Plus,
  X,
  Save,
  Pencil,
  CheckCircle2,
  Ban,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Industry {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { vendors: number };
}

// ─── Shared input class ───────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20";

// ─── Modal ───────────────────────────────────────────────────────────────────

function IndustryFormModal({
  industry,
  onClose,
  onSuccess,
}: {
  industry?: Industry | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(industry?.name ?? "");
  const [slug, setSlug] = useState(industry?.slug ?? "");
  const [description, setDescription] = useState(industry?.description ?? "");
  const [isActive, setIsActive] = useState(industry?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const isEditing = !!industry;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, ""),
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) { setError("Name and slug are required"); return; }
    setIsSaving(true);
    setError("");
    try {
      if (isEditing) {
        await apiClient.put(`/industries/${industry.id}`, {
          name: name.trim(), slug: slug.trim(),
          description: description.trim() || null, isActive,
        });
        toast.success("Industry updated");
      } else {
        await apiClient.post("/industries", {
          name: name.trim(), slug: slug.trim(),
          description: description.trim() || null, isActive,
        });
        toast.success("Industry created");
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? (isEditing ? "Failed to update" : "Failed to create"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
              {isEditing
                ? <Pencil size={18} className="text-emerald-700 dark:text-emerald-400" />
                : <Plus size={18} className="text-emerald-700 dark:text-emerald-400" />}
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {isEditing ? "Edit Industry" : "Create Industry"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Name *
            </label>
            <input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Slug *
            </label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>
          {isEditing && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-200">
                Active
              </label>
            </div>
          )}
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-bold text-white shadow hover:bg-emerald-800 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isSaving ? "Saving..." : isEditing ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminIndustriesPage() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingIndustry, setEditingIndustry] = useState<Industry | null>(null);

  const loadIndustries = useCallback(async (p: number, q?: string) => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, limit: 20 };
      if (q) params.search = q;
      const res = await apiClient.get<{
        success: boolean;
        data: Industry[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>("/industries", { params });
      setIndustries(res.data.data);
      setTotal(res.data.pagination.total);
      setPage(res.data.pagination.page);
      setTotalPages(res.data.pagination.totalPages);
    } catch {
      toast.error("Failed to load industries");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadIndustries(1); }, [loadIndustries]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadIndustries(1, search || undefined);
  };

  return (
    <RoleGuard allowedRoles={["ADMIN"]}>
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
              <Factory size={24} className="text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Industries</h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Manage business industries for vendor classification
              </p>
            </div>
          </div>
          <button
            onClick={() => { setEditingIndustry(null); setShowModal(true); }}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-800 transition-all"
          >
            <Plus size={16} /> Create Industry
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search industries..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
            />
          </div>
        </form>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
          </div>
        ) : industries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50">
              <Factory size={28} className="text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">No industries found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {search ? "Try a different search term" : "Create your first industry to get started"}
            </p>
            {!search && (
              <button
                onClick={() => { setEditingIndustry(null); setShowModal(true); }}
                className="mt-6 flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 transition-all"
              >
                <Plus size={16} /> Create Industry
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/30">
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-300">Name</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-300">Slug</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-300">Description</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-300">Vendors</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-300">Status</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {industries.map((ind) => (
                    <tr key={ind.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-5 py-4 font-medium text-gray-900 dark:text-gray-100">{ind.name}</td>
                      <td className="px-5 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">{ind.slug}</td>
                      <td className="max-w-xs truncate px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {ind.description || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {ind._count?.vendors ?? 0}
                      </td>
                      <td className="px-5 py-4">
                        {ind.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 size={10} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 dark:bg-gray-700 px-2.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                            <Ban size={10} /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => { setEditingIndustry(ind); setShowModal(true); }}
                          className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 px-5 py-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {total} industries · Page {page} of {totalPages}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => loadIndustries(page - 1)}
                    disabled={page <= 1}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => loadIndustries(page + 1)}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <IndustryFormModal
          industry={editingIndustry}
          onClose={() => { setShowModal(false); setEditingIndustry(null); }}
          onSuccess={() => loadIndustries(page)}
        />
      )}
    </RoleGuard>
  );
}
