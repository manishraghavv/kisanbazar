"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { useProductCatalogStore } from "@/stores/productCatalogStore";
import {
  ChevronLeft,
  Loader2,
  Save,
  SendHorizonal,
  X,
  PackageSearch,
  Plus,
  Sprout,
  AlertTriangle,
  Layers,
  Image as ImageIcon,
  Settings2,
} from "lucide-react";
import type { Category, ProductDetail } from "@/types/auth";

// ─── Common crop options ────────────────────────────────────────────────────

const COMMON_CROPS = [
  "Wheat", "Rice", "Cotton", "Sugarcane", "Maize",
  "Paddy", "Mustard", "Groundnut", "Soybean", "Pulses",
  "Barley", "Millet", "Sunflower", "Tea", "Coffee",
  "Vegetables", "Fruits", "Spices", "Fodder", "Other",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const { categories, fetchCategories, categoriesLoading, fetchProductById, isProductLoading } =
    useProductCatalogStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form fields
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [nameHi, setNameHi] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionHi, setDescriptionHi] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [gstRate, setGstRate] = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("");
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [cropInput, setCropInput] = useState("");
  const [seasonalFlag, setSeasonalFlag] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load categories and product on mount
  useEffect(() => {
    Promise.all([
      fetchCategories().catch(() => {}),
      fetchProductById(productId),
    ])
      .then(([, productDetail]) => {
        const p = productDetail;
        setProduct(p);
        setCategoryId(p.category.id);
        setName(p.name);
        setNameHi(p.nameHi ?? "");
        setDescription(p.description ?? "");
        setDescriptionHi(p.descriptionHi ?? "");
        setHsnCode(p.hsnCode ?? "");
        setGstRate(p.gstRate?.toString() ?? "");
        setUnitOfMeasure(p.unitOfMeasure ?? "");
        setSelectedCrops(p.applicableCrops ?? []);
        setSeasonalFlag(p.seasonalFlag);
        setIsLoading(false);
      })
      .catch((err) => {
        setFetchError(err instanceof Error ? err.message : "Failed to load product");
        setIsLoading(false);
      });
  }, [productId, fetchCategories, fetchProductById]);

  // Validate form
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!categoryId) errs.categoryId = "Category is required";
    if (!name.trim()) errs.name = "Product name is required";
    else if (name.trim().length < 2) errs.name = "Name must be at least 2 characters";
    else if (name.trim().length > 200) errs.name = "Name must be under 200 characters";
    if (description.length > 2000) errs.description = "Description must be under 2000 characters";
    if (hsnCode && !/^\d{4,8}$/.test(hsnCode)) errs.hsnCode = "HSN code must be 4-8 digits";
    if (gstRate) {
      const rate = Number(gstRate);
      if (isNaN(rate) || rate < 0 || rate > 100) errs.gstRate = "GST rate must be between 0 and 100";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Handle crop add
  const addCrop = (crop: string) => {
    if (!selectedCrops.includes(crop)) {
      setSelectedCrops([...selectedCrops, crop]);
    }
    setCropInput("");
  };

  const removeCrop = (crop: string) => {
    setSelectedCrops(selectedCrops.filter((c) => c !== crop));
  };

  // Handle save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    try {
      const payload = {
        categoryId,
        name: name.trim(),
        nameHi: nameHi.trim() || undefined,
        description: description.trim() || undefined,
        descriptionHi: descriptionHi.trim() || undefined,
        hsnCode: hsnCode.trim() || undefined,
        gstRate: gstRate ? Number(gstRate) : undefined,
        unitOfMeasure: unitOfMeasure.trim() || undefined,
        applicableCrops: selectedCrops.length > 0 ? selectedCrops : undefined,
        seasonalFlag,
      };

      await apiClient.put<{ success: boolean; message?: string }>(
        `/products/${productId}`,
        payload,
      );

      toast.success("Product updated successfully");
      router.push("/dashboard/vendor/products");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string; errors?: Array<{ field: string; message: string }> } } };
      const msg = axiosError.response?.data?.message ?? "Failed to update product";
      toast.error(msg);
      if (axiosError.response?.data?.errors) {
        const backendErrors: Record<string, string> = {};
        for (const e of axiosError.response.data.errors) {
          backendErrors[e.field] = e.message;
        }
        setErrors(backendErrors);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Handle submit for moderation
  const handleSubmitForModeration = async () => {
    if (!confirm("Submit this product for admin approval? You won't be able to edit it until it's reviewed.")) return;

    setIsSubmitting(true);
    try {
      await apiClient.post(`/products/${productId}/submit`);
      toast.success("Product submitted for moderation!");
      router.push("/dashboard/vendor/products");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to submit for moderation");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Flatten categories for select
  const flattenCategories = (cats: Category[], depth = 0): Array<{ id: string; label: string }> => {
    const result: Array<{ id: string; label: string }> = [];
    for (const cat of cats) {
      result.push({ id: cat.id, label: `${"—".repeat(depth)} ${cat.name}` });
      if (cat.children) result.push(...flattenCategories(cat.children, depth + 1));
    }
    return result;
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
  if (fetchError || !product) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30">
            <AlertTriangle size={28} className="text-red-300" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
            {fetchError ?? "Product not found"}
          </h2>
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
          <Link href="/dashboard/vendor/products" className="hover:text-emerald-700 dark:hover:text-emerald-400">My Products</Link>
          <span>/</span>
          <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">Edit: {product.name}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
              {product.images[0]?.imageUrl ? (
                <img src={product.images[0].imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <PackageSearch size={24} className="text-emerald-700 dark:text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100 truncate">{product.name}</h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                {product.status.replace(/_/g, " ")} · {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/vendor/products"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50"
          >
            <ChevronLeft size={16} />
            Back
          </Link>
        </div>
      </div>

      {/* Quick Links to Sub-pages */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/vendor/products/${productId}/variants`}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 shadow-sm dark:shadow-gray-950/30 hover:border-emerald-200 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
        >
          <Layers size={14} />
          Variants ({product.variants.length})
        </Link>
        <Link
          href={`/dashboard/vendor/products/${productId}/images`}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 shadow-sm dark:shadow-gray-950/30 hover:border-emerald-200 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
        >
          <ImageIcon size={14} />
          Images ({product.images.length})
        </Link>
        <Link
          href={`/dashboard/vendor/products/${productId}/attributes`}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 shadow-sm dark:shadow-gray-950/30 hover:border-emerald-200 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
        >
          <Settings2 size={14} />
          Attributes
        </Link>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Info Card */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
          <h2 className="mb-5 text-base font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Basic Information</h2>

          {/* Category */}
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Category <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            {categoriesLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                <Loader2 size={14} className="animate-spin" />
                Loading categories...
              </div>
            ) : (
              <select
                value={categoryId}
                onChange={(e) => { setCategoryId(e.target.value); setErrors((prev) => ({ ...prev, categoryId: "" })); }}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 dark:focus:ring-offset-gray-800 ${
                  errors.categoryId ? "border-red-400 focus:border-red-500" : "border-gray-300 dark:border-gray-600 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
                }`}
              >
                <option value="">Select a category...</option>
                {flattenCategories(categories).map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            )}
            {errors.categoryId && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.categoryId}</p>}
          </div>

          {/* Name (English) */}
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Product Name (English) <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: "" })); }}
              className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 dark:focus:ring-offset-gray-800 ${
                errors.name ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : "border-gray-300 dark:border-gray-600 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.name}</p>}
          </div>

          {/* Name (Hindi) */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Product Name (हिन्दी) <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-normal">optional</span>
            </label>
            <input
              value={nameHi}
              onChange={(e) => setNameHi(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
            />
          </div>
        </div>

        {/* Description Card */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
          <h2 className="mb-5 text-base font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Description</h2>

          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Description (English) <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-normal">optional</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setErrors((prev) => ({ ...prev, description: "" })); }}
              rows={4}
              className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 dark:focus:ring-offset-gray-800 resize-y ${
                errors.description ? "border-red-400 focus:border-red-500" : "border-gray-300 dark:border-gray-600 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
              }`}
            />
            <div className="mt-1 flex justify-between">
              {errors.description ? <p className="text-xs text-red-500 dark:text-red-400">{errors.description}</p> : <span />}
              <span className={`text-xs ${description.length > 2000 ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500"}`}>
                {description.length}/2000
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Description (हिन्दी) <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-normal">optional</span>
            </label>
            <textarea
              value={descriptionHi}
              onChange={(e) => setDescriptionHi(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20 resize-y"
            />
          </div>
        </div>

        {/* Classification Card */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
          <h2 className="mb-5 text-base font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Classification & Compliance</h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                HSN Code <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-normal">optional</span>
              </label>
              <input
                value={hsnCode}
                onChange={(e) => { setHsnCode(e.target.value); setErrors((prev) => ({ ...prev, hsnCode: "" })); }}
                maxLength={8}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 dark:focus:ring-offset-gray-800 font-mono ${
                  errors.hsnCode ? "border-red-400 focus:border-red-500" : "border-gray-300 dark:border-gray-600 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
                }`}
              />
              {errors.hsnCode && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.hsnCode}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                GST Rate (%) <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-normal">optional</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={gstRate}
                  onChange={(e) => { setGstRate(e.target.value); setErrors((prev) => ({ ...prev, gstRate: "" })); }}
                  min={0}
                  max={100}
                  className={`w-full rounded-lg border px-3.5 py-2.5 pr-8 text-sm outline-none transition-all focus:ring-2 dark:focus:ring-offset-gray-800 ${
                    errors.gstRate ? "border-red-400 focus:border-red-500" : "border-gray-300 dark:border-gray-600 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
                  }`}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">%</span>
              </div>
              {errors.gstRate && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.gstRate}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Unit of Measure <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-normal">optional</span>
              </label>
              <select
                value={unitOfMeasure}
                onChange={(e) => setUnitOfMeasure(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400"
              >
                <option value="">Select unit...</option>
                <option value="Kg">Kg (Kilogram)</option>
                <option value="g">g (Gram)</option>
                <option value="L">L (Litre)</option>
                <option value="mL">mL (Millilitre)</option>
                <option value="Pieces">Pieces</option>
                <option value="Bag">Bag</option>
                <option value="Packet">Packet</option>
                <option value="Box">Box</option>
                <option value="Carton">Carton</option>
                <option value="Sack">Sack</option>
                <option value="Ton">Tonne</option>
                <option value="Acre">Acre</option>
                <option value="Unit">Unit</option>
              </select>
            </div>

            <div className="flex items-end pb-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seasonalFlag}
                  onChange={(e) => setSeasonalFlag(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 dark:border-gray-600 dark:border-gray-600 text-emerald-700 dark:text-emerald-400 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">Seasonal Product</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Available only during specific seasons</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Crops Card */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
          <h2 className="mb-5 text-base font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
            Applicable Crops <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-normal text-sm">optional</span>
          </h2>

          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Quick add common crops:</p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_CROPS.filter((c) => !selectedCrops.includes(c)).slice(0, 8).map((crop) => (
                <button
                  key={crop}
                  type="button"
                  onClick={() => addCrop(crop)}
                  className="rounded-full border border-gray-200 dark:border-gray-700 dark:border-gray-700 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 hover:border-emerald-300 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                >
                  <Plus size={10} className="inline mr-0.5" />
                  {crop}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <input
              value={cropInput}
              onChange={(e) => setCropInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (cropInput.trim()) addCrop(cropInput.trim());
                }
              }}
              placeholder="Type a crop name and press Enter..."
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
            />
            <button
              type="button"
              onClick={() => { if (cropInput.trim()) addCrop(cropInput.trim()); }}
              disabled={!cropInput.trim()}
              className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"
            >
              <Plus size={16} />
            </button>
          </div>

          {selectedCrops.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedCrops.map((crop) => (
                <span
                  key={crop}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300"
                >
                  <Sprout size={12} />
                  {crop}
                  <button
                    type="button"
                    onClick={() => removeCrop(crop)}
                    className="rounded-full p-0.5 text-emerald-500 hover:bg-emerald-200 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 italic">
              Select crops this product is suitable for
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-950/30">
          {/* Submit for Moderation (only if DRAFT) */}
          {product.status === "DRAFT" && (
            <button
              type="button"
              onClick={handleSubmitForModeration}
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30 px-5 py-2.5 text-sm font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <SendHorizonal size={16} />
              )}
              {isSubmitting ? "Submitting..." : "Submit for Approval"}
            </button>
          )}

          <div className="flex items-center gap-3 ml-auto">
            <Link
              href="/dashboard/vendor/products"
              className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow transition-all hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
