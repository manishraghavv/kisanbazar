"use client";

import { useEffect, useState } from "react";
import { useAdminStore } from "@/stores/adminStore";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Trash2,
  X,
  Save,
} from "lucide-react";
import type { Category } from "@/types/auth";

const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3.5 py-2.5 text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function AdminCategoriesPage() {
  const {
    categories, categoriesTotal, isCategoriesLoading, isCategorySaving,
    fetchAdminCategories, createCategory, updateCategory, deleteCategory,
  } = useAdminStore();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [nameHi, setNameHi] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Category | null>(null);

  useEffect(() => {
    fetchAdminCategories(page, 20, search || undefined).catch(() =>
      toast.error("Failed to load categories"),
    );
  }, [page, search, fetchAdminCategories]);

  const openCreate = () => {
    setEditCategory(null);
    setName(""); setNameHi(""); setSlug(""); setSortOrder(0);
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditCategory(cat);
    setName(cat.name);
    setNameHi(cat.nameHi ?? "");
    setSlug(cat.slug);
    setSortOrder(cat.sortOrder);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      if (editCategory) {
        await updateCategory(editCategory.id, {
          name: name.trim(), nameHi: nameHi || undefined,
          slug: slug || undefined, sortOrder,
        });
        toast.success("Category updated");
      } else {
        await createCategory({
          name: name.trim(), nameHi: nameHi || undefined,
          slug: slug || undefined, sortOrder,
        });
        toast.success("Category created");
      }
      setShowModal(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? "Failed to save category");
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    try {
      await deleteCategory(showDeleteConfirm.id);
      toast.success("Category deleted");
      setShowDeleteConfirm(null);
    } catch { toast.error("Failed to delete category"); }
  };

  const totalPagesNum = Math.ceil(categoriesTotal / 20);

  return (
    <div className="mx-auto max-w-4xl">

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Categories</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{categoriesTotal} total</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-800"
        >
          <Plus size={16} /> New Category
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search categories..."
          className={`${inputCls} pl-10`}
        />
      </div>

      {/* Table */}
      {isCategoriesLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Slug</th>
                <th className="px-4 py-3 text-center">Order</th>
                <th className="px-4 py-3 text-left">Parent</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {categories.map((cat) => (
                <tr key={cat.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {cat.name}
                    {cat.nameHi && (
                      <span className="ml-1 text-gray-400 dark:text-gray-500">({cat.nameHi})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{cat.slug}</td>
                  <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-200">{cat.sortOrder}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{cat.parent?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{formatDate(cat.createdAt ?? "")}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(cat)}
                        className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(cat)}
                        className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPagesNum > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-gray-300 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: Math.min(totalPagesNum, 5) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, totalPagesNum - 4));
            const p = start + i;
            if (p > totalPagesNum) return null;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                  p === page
                    ? "bg-emerald-700 text-white"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPagesNum, p + 1))}
            disabled={page >= totalPagesNum}
            className="rounded-lg border border-gray-300 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {editCategory ? "Edit Category" : "New Category"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Name (Hindi)</label>
                <input value={nameHi} onChange={(e) => setNameHi(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Slug</label>
                <input value={slug} onChange={(e) => setSlug(e.target.value)} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Sort Order</label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!name.trim() || isCategorySaving}
                  className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-800 disabled:opacity-50"
                >
                  {isCategorySaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {editCategory ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
              <Trash2 size={24} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-center text-lg font-bold text-gray-900 dark:text-gray-100">Delete Category?</h3>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
              This will delete <strong>{showDeleteConfirm.name}</strong>.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
