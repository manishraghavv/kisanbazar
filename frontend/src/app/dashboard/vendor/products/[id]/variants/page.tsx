"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { useProductCatalogStore } from "@/stores/productCatalogStore";
import { ChevronLeft, Loader2, Plus, Pencil, Trash2, PackageSearch, Image as ImageIcon, Settings2, Layers, AlertTriangle, Search, DollarSign, Package, Weight, Hash } from "lucide-react";
import type { ProductVariant } from "@/types/auth";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

const emptyVariantForm = {
  sku: "",
  variantName: "",
  mrp: "",
  sellingPrice: "",
  stockQuantity: "0",
  reorderThreshold: "0",
  weightGrams: "",
};

// ─── Variant Form Component (shared between add & edit) ──────────────────────

function VariantForm({
  initial,
  onSave,
  onCancel,
  isSaving,
  title,
}: {
  initial: typeof emptyVariantForm;
  onSave: (data: Record<string, unknown>) => void;
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
    if (!form.sku.trim()) errs.sku = "SKU is required";
    if (form.sku.trim().length > 100) errs.sku = "SKU must be under 100 characters";
    if (form.variantName && form.variantName.length > 200) errs.variantName = "Name must be under 200 characters";

    const mrp = Number(form.mrp);
    if (!form.mrp.trim() || isNaN(mrp) || mrp <= 0) errs.mrp = "MRP must be a positive number";

    const sellingPrice = Number(form.sellingPrice);
    if (!form.sellingPrice.trim() || isNaN(sellingPrice) || sellingPrice <= 0)
      errs.sellingPrice = "Selling price must be a positive number";

    const stockQty = Number(form.stockQuantity);
    if (!form.stockQuantity.trim() || isNaN(stockQty) || stockQty < 0 || !Number.isInteger(stockQty))
      errs.stockQuantity = "Stock quantity must be a non-negative integer";

    const reorder = Number(form.reorderThreshold);
    if (!form.reorderThreshold.trim() || isNaN(reorder) || reorder < 0 || !Number.isInteger(reorder))
      errs.reorderThreshold = "Reorder threshold must be a non-negative integer";

    if (form.weightGrams.trim()) {
      const weight = Number(form.weightGrams);
      if (isNaN(weight) || weight <= 0 || !Number.isInteger(weight))
        errs.weightGrams = "Weight must be a positive integer";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: Record<string, unknown> = {
      sku: form.sku.trim(),
      variantName: form.variantName.trim() || undefined,
      mrp: Number(form.mrp),
      sellingPrice: Number(form.sellingPrice),
      stockQuantity: Number(form.stockQuantity),
      reorderThreshold: Number(form.reorderThreshold),
    };
    if (form.weightGrams.trim()) payload.weightGrams = Number(form.weightGrams);

    onSave(payload);
  };

  const inputClass = (field: string) =>
    `w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 dark:focus:ring-offset-gray-800 ${
      errors[field]
        ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
        : "border-gray-300 dark:border-gray-600 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
    }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* SKU */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            SKU <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <input
            value={form.sku}
            onChange={(e) => handleChange("sku", e.target.value)}
            placeholder="e.g., WHT-001"
            className={inputClass("sku")}
          />
          {errors.sku && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.sku}</p>}
        </div>

        {/* Variant Name */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            Variant Name <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-normal">optional</span>
          </label>
          <input
            value={form.variantName}
            onChange={(e) => handleChange("variantName", e.target.value)}
            placeholder="e.g., Premium Grade A"
            className={inputClass("variantName")}
          />
          {errors.variantName && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.variantName}</p>}
        </div>

        {/* MRP */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            MRP <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">₹</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.mrp}
              onChange={(e) => handleChange("mrp", e.target.value)}
              placeholder="0.00"
              className={`${inputClass("mrp")} pl-8`}
            />
          </div>
          {errors.mrp && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.mrp}</p>}
        </div>

        {/* Selling Price */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            Selling Price <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">₹</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.sellingPrice}
              onChange={(e) => handleChange("sellingPrice", e.target.value)}
              placeholder="0.00"
              className={`${inputClass("sellingPrice")} pl-8`}
            />
          </div>
          {errors.sellingPrice && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.sellingPrice}</p>}
        </div>

        {/* Stock Quantity */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            Stock Quantity <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.stockQuantity}
            onChange={(e) => handleChange("stockQuantity", e.target.value)}
            className={inputClass("stockQuantity")}
          />
          {errors.stockQuantity && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.stockQuantity}</p>}
        </div>

        {/* Reorder Threshold */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            Reorder Threshold <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.reorderThreshold}
            onChange={(e) => handleChange("reorderThreshold", e.target.value)}
            className={inputClass("reorderThreshold")}
          />
          {errors.reorderThreshold && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.reorderThreshold}</p>}
        </div>

        {/* Weight */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            Weight (grams) <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-normal">optional</span>
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={form.weightGrams}
            onChange={(e) => handleChange("weightGrams", e.target.value)}
            placeholder="e.g., 500"
            className={inputClass("weightGrams")}
          />
          {errors.weightGrams && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.weightGrams}</p>}
        </div>
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
          {isSaving ? <Loader2 size={15} className="animate-spin" /> : title === "Add Variant" ? <Plus size={15} /> : <Pencil size={15} />}
          {isSaving ? "Saving..." : title}
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManageVariantsPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const { fetchProductById, isProductLoading } = useProductCatalogStore();

  const [productName, setProductName] = useState("");
  const [productStatus, setProductStatus] = useState("");
  const [productImage, setProductImage] = useState("");
  const [productVariantCount, setProductVariantCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Variants list
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [isVariantsLoading, setIsVariantsLoading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Search
  const [search, setSearch] = useState("");

  // Fetch product info & variants
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const product = await fetchProductById(productId);
      setProductName(product.name);
      setProductStatus(product.status);
      setProductImage(product.images[0]?.imageUrl ?? "");
      setProductVariantCount(product.variants.length);
      setIsLoading(false);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load product");
      setIsLoading(false);
    }
  }, [productId, fetchProductById]);

  const loadVariants = useCallback(async () => {
    setIsVariantsLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: ProductVariant[] }>(
        `/products/${productId}/variants`
      );
      setVariants(res.data.data);
      setProductVariantCount(res.data.data.length);
    } catch {
      toast.error("Failed to load variants");
    } finally {
      setIsVariantsLoading(false);
    }
  }, [productId]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadData();
    loadVariants();
  }, [loadData, loadVariants]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Open modal for adding a variant
  const handleAdd = () => {
    setEditingVariant(null);
    setShowModal(true);
  };

  // Open modal for editing a variant
  const handleEdit = (variant: ProductVariant) => {
    setEditingVariant(variant);
    setShowModal(true);
  };

  // Save variant (create or update)
  const handleSave = async (data: Record<string, unknown>) => {
    setIsSaving(true);
    try {
      if (editingVariant) {
        await apiClient.put(`/variants/${editingVariant.id}`, data);
        toast.success("Variant updated");
      } else {
        await apiClient.post(`/products/${productId}/variants`, data);
        toast.success("Variant added");
      }
      setShowModal(false);
      setEditingVariant(null);
      await loadVariants();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string; errors?: Array<{ field: string; message: string }> } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to save variant");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete variant
  const handleDelete = async (variantId: string, variantName: string | null) => {
    if (!confirm(`Delete variant "${variantName ?? variantId}"? This cannot be undone.`)) return;

    setIsDeleting(variantId);
    try {
      await apiClient.delete(`/variants/${variantId}`);
      toast.success("Variant deleted");
      await loadVariants();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to delete variant");
    } finally {
      setIsDeleting(null);
    }
  };

  // Filtered variants
  const filteredVariants = variants.filter((v) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      v.sku.toLowerCase().includes(q) ||
      (v.variantName ?? "").toLowerCase().includes(q)
    );
  });

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
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-2">
          <Link href="/dashboard/vendor/products" className="hover:text-emerald-700 dark:hover:text-emerald-400">
            My Products
          </Link>
          <span>/</span>
          <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">Variants: {productName}</span>
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
                {productStatus.replace(/_/g, " ")} · {productVariantCount} variant{productVariantCount !== 1 ? "s" : ""}
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

      {/* Quick Links to Sub-pages */}
      <div className="mb-6 flex flex-wrap gap-2">
        <span className="flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 px-3.5 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 shadow-sm dark:shadow-gray-950/30">
          <Layers size={14} />
          Variants ({productVariantCount})
        </span>
        <Link
          href={`/dashboard/vendor/products/${productId}/images`}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 shadow-sm dark:shadow-gray-950/30 hover:border-emerald-200 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
        >
          <ImageIcon size={14} />
          Images
        </Link>
        <Link
          href={`/dashboard/vendor/products/${productId}/attributes`}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 shadow-sm dark:shadow-gray-950/30 hover:border-emerald-200 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
        >
          <Settings2 size={14} />
          Attributes
        </Link>
      </div>

      {/* Controls: Search + Add Button */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search variants by SKU or name..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
          />
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow transition-all hover:bg-emerald-800"
        >
          <Plus size={16} />
          Add Variant
        </button>
      </div>

      {/* Variants List */}
      {isVariantsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
        </div>
      ) : filteredVariants.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 dark:border-gray-600 dark:border-gray-600 dark:border-gray-600 py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
            <Package size={28} className="text-gray-300" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
            {search ? "No matching variants" : "No variants yet"}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {search ? "Try a different search term" : "Add at least one variant to start selling this product"}
          </p>
          {!search && (
            <button
              onClick={handleAdd}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-800 transition-colors"
            >
              <Plus size={15} />
              Add First Variant
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVariants.map((variant) => (
            <div
              key={variant.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                      {variant.variantName ?? "Default Variant"}
                    </p>
                    <span className="rounded-full bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300 dark:text-gray-300">
                      {variant.sku}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      <DollarSign size={12} className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
                      <span>
                        <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(variant.sellingPrice)}</span>
                        {variant.mrp > variant.sellingPrice && (
                          <span className="ml-1 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 line-through">{formatCurrency(variant.mrp)}</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      <Package size={12} className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
                      <span>
                        <span className={variant.stockQuantity > 0 ? "font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100" : "font-medium text-red-600 dark:text-red-400"}>
                          {variant.stockQuantity}
                        </span>{" "}
                        in stock
                        {variant.reorderThreshold != null && variant.reorderThreshold > 0 && (
                          <span className="ml-1 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">(min: {variant.reorderThreshold})</span>
                        )}
                      </span>
                    </div>
                    {variant.weightGrams && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                        <Weight size={12} className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
                        <span>{variant.weightGrams}g</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      <Hash size={12} className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
                      <span>MRP: {formatCurrency(variant.mrp)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <button
                    onClick={() => handleEdit(variant)}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 p-2 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                    title="Edit variant"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(variant.id, variant.variantName)}
                    disabled={isDeleting === variant.id}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 p-2 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 hover:text-red-700 transition-colors disabled:opacity-50"
                    title="Delete variant"
                  >
                    {isDeleting === variant.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-xl rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                {editingVariant ? "Edit Variant" : "Add Variant"}
              </h3>
              <button
                onClick={() => { setShowModal(false); setEditingVariant(null); }}
                className="rounded-lg p-1 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <VariantForm
              title={editingVariant ? "Save Changes" : "Add Variant"}
              initial={
                editingVariant
                  ? {
                      sku: editingVariant.sku,
                      variantName: editingVariant.variantName ?? "",
                      mrp: editingVariant.mrp.toString(),
                      sellingPrice: editingVariant.sellingPrice.toString(),
                      stockQuantity: editingVariant.stockQuantity.toString(),
                      reorderThreshold: "0",
                      weightGrams: editingVariant.weightGrams?.toString() ?? "",
                    }
                  : emptyVariantForm
              }
              onSave={handleSave}
              onCancel={() => { setShowModal(false); setEditingVariant(null); }}
              isSaving={isSaving}
            />
          </div>
        </div>
      )}
    </div>
  );
}
