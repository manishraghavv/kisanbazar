"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { useProductCatalogStore } from "@/stores/productCatalogStore";
import {
  ChevronLeft,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Settings2,
  Layers,
  Image as ImageIcon,
  PackageSearch,
  AlertTriangle,
  List,
} from "lucide-react";

interface ProductAttribute {
  id: string;
  name: string;
  value: string;
  nameHi: string | null;
}

const emptyAttributeForm = {
  name: "",
  value: "",
  nameHi: "",
};

// ─── Attribute Form Component (shared between add & edit) ───────────────────

function AttributeForm({
  initial,
  onSave,
  onCancel,
  isSaving,
  title,
}: {
  initial: typeof emptyAttributeForm;
  onSave: (data: { name: string; value: string; nameHi?: string }) => void;
  onCancel: () => void;
  isSaving: boolean;
  title: string;
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Attribute name is required";
    else if (form.name.trim().length > 100) errs.name = "Name must be under 100 characters";
    if (!form.value.trim()) errs.value = "Attribute value is required";
    else if (form.value.trim().length > 500) errs.value = "Value must be under 500 characters";
    if (form.nameHi && form.nameHi.length > 100) errs.nameHi = "Hindi name must be under 100 characters";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      name: form.name.trim(),
      value: form.value.trim(),
      nameHi: form.nameHi.trim() || undefined,
    });
  };

  const inputClass = (field: string) =>
    `w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 dark:focus:ring-offset-gray-800 ${
      errors[field]
        ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
        : "border-gray-300 dark:border-gray-600 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
    }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
          Attribute Name <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          value={form.name}
          onChange={(e) => handleChange("name", e.target.value)}
          placeholder="e.g., Shelf Life, Variety, Color"
          className={inputClass("name")}
        />
        {errors.name && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.name}</p>}
      </div>

      {/* Value */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
          Value <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          value={form.value}
          onChange={(e) => handleChange("value", e.target.value)}
          placeholder="e.g., 6 months, Basmati, Red"
          className={inputClass("value")}
        />
        {errors.value && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.value}</p>}
      </div>

      {/* Name (Hindi) */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
          Attribute Name (हिन्दी) <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-normal">optional</span>
        </label>
        <input
          value={form.nameHi}
          onChange={(e) => handleChange("nameHi", e.target.value)}
          placeholder="e.g., शेल्फ लाइफ"
          className={inputClass("nameHi")}
        />
        {errors.nameHi && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.nameHi}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-700 dark:border-gray-700 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-bold text-white shadow transition-all hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 size={15} className="animate-spin" />
          ) : title === "Add Attribute" ? (
            <Plus size={15} />
          ) : (
            <Pencil size={15} />
          )}
          {isSaving ? "Saving..." : title}
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManageAttributesPage() {
  const params = useParams();
  const productId = params.id as string;

  const { fetchProductById, isProductLoading } = useProductCatalogStore();

  const [productName, setProductName] = useState("");
  const [productStatus, setProductStatus] = useState("");
  const [productImage, setProductImage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Attributes list
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<ProductAttribute | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Fetch product info & attributes from product detail
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const product = await fetchProductById(productId);
      setProductName(product.name);
      setProductStatus(product.status);
      setProductImage(product.images[0]?.imageUrl ?? "");
      setAttributes(product.attributes ?? []);
      setIsLoading(false);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load product");
      setIsLoading(false);
    }
  }, [productId, fetchProductById]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open modal for adding
  const handleAdd = () => {
    setEditingAttribute(null);
    setShowModal(true);
  };

  // Open modal for editing
  const handleEdit = (attr: ProductAttribute) => {
    setEditingAttribute(attr);
    setShowModal(true);
  };

  // Save attribute (create or update)
  const handleSave = async (data: { name: string; value: string; nameHi?: string }) => {
    setIsSaving(true);
    try {
      if (editingAttribute) {
        await apiClient.put(`/products/${productId}/attributes/${editingAttribute.id}`, data);
        toast.success("Attribute updated");
      } else {
        await apiClient.post(`/products/${productId}/attributes`, data);
        toast.success("Attribute added");
      }
      setShowModal(false);
      setEditingAttribute(null);
      await loadData(); // Refresh to get updated attributes list
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string; errors?: Array<{ field: string; message: string }> } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to save attribute");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete attribute
  const handleDelete = async (attributeId: string, name: string) => {
    if (!confirm(`Delete attribute "${name}"? This cannot be undone.`)) return;

    setIsDeleting(attributeId);
    try {
      await apiClient.delete(`/products/${productId}/attributes/${attributeId}`);
      toast.success("Attribute deleted");
      await loadData();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to delete attribute");
    } finally {
      setIsDeleting(null);
    }
  };

  // Loading state
  if (isLoading || isProductLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Loading product...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (fetchError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30">
            <AlertTriangle size={28} className="text-red-300" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{fetchError}</h2>
          <Link
            href="/dashboard/vendor/products"
            className="mt-6 flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50"
          >
            <ChevronLeft size={16} />
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-2">
          <Link href="/dashboard/vendor/products" className="hover:text-emerald-700 dark:hover:text-emerald-400">
            My Products
          </Link>
          <span>/</span>
          <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">Attributes: {productName}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
              {productImage ? (
                <img src={productImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <PackageSearch size={24} className="text-emerald-700 dark:text-emerald-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{productName}</h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                {productStatus.replace(/_/g, " ")} · {attributes.length} attribute{attributes.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Link
            href={`/dashboard/vendor/products/${productId}/edit`}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50"
          >
            <ChevronLeft size={16} />
            Back to Edit
          </Link>
        </div>
      </div>

      {/* Quick Links */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/vendor/products/${productId}/variants`}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 shadow-sm dark:shadow-gray-950/30 hover:border-emerald-200 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
        >
          <Layers size={14} />
          Variants
        </Link>
        <Link
          href={`/dashboard/vendor/products/${productId}/images`}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 shadow-sm dark:shadow-gray-950/30 hover:border-emerald-200 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
        >
          <ImageIcon size={14} />
          Images
        </Link>
        <span className="flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 px-3.5 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 shadow-sm dark:shadow-gray-950/30">
          <Settings2 size={14} />
          Attributes ({attributes.length})
        </span>
      </div>

      {/* Controls */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
          Specifications shown on the product detail page
        </p>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow transition-all hover:bg-emerald-800"
        >
          <Plus size={16} />
          Add Attribute
        </button>
      </div>

      {/* Attributes List */}
      {attributes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 dark:border-gray-600 dark:border-gray-600 dark:border-gray-600 py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
            <List size={28} className="text-gray-300" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">No attributes yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            Add specifications like shelf life, variety, or color
          </p>
          <button
            onClick={handleAdd}
            className="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-800 transition-colors"
          >
            <Plus size={15} />
            Add First Attribute
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Attribute
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Value
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hidden sm:table-cell">
                  हिन्दी
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 dark:divide-gray-700">
              {attributes.map((attr) => (
                <tr
                  key={attr.id}
                  className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50/50"
                >
                  <td className="px-5 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                    {attr.name}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-200 dark:text-gray-200">
                    {attr.value}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hidden sm:table-cell">
                    {attr.nameHi ?? (
                      <span className="text-gray-300 italic">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(attr)}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 p-2 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                        title="Edit attribute"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(attr.id, attr.name)}
                        disabled={isDeleting === attr.id}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 p-2 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 hover:text-red-700 transition-colors disabled:opacity-50"
                        title="Delete attribute"
                      >
                        {isDeleting === attr.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {editingAttribute ? "Edit Attribute" : "Add Attribute"}
              </h3>
              <button
                onClick={() => { setShowModal(false); setEditingAttribute(null); }}
                className="rounded-lg p-1 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <AttributeForm
              title={editingAttribute ? "Save Changes" : "Add Attribute"}
              initial={
                editingAttribute
                  ? {
                      name: editingAttribute.name,
                      value: editingAttribute.value,
                      nameHi: editingAttribute.nameHi ?? "",
                    }
                  : emptyAttributeForm
              }
              onSave={handleSave}
              onCancel={() => { setShowModal(false); setEditingAttribute(null); }}
              isSaving={isSaving}
            />
          </div>
        </div>
      )}
    </div>
  );
}
