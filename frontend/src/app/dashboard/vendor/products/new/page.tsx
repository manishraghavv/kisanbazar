"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import apiClient from "@/lib/api-client";
import { useProductCatalogStore } from "@/stores/productCatalogStore";
import {
  ChevronLeft,
  Loader2,
  Save,
  X,
  PackageSearch,
  Plus,
  Sprout,
} from "lucide-react";
import type { Category } from "@/types/auth";

// ─── Common crop options ────────────────────────────────────────────────────

const COMMON_CROPS = [
  "Wheat", "Rice", "Cotton", "Sugarcane", "Maize",
  "Paddy", "Mustard", "Groundnut", "Soybean", "Pulses",
  "Barley", "Millet", "Sunflower", "Tea", "Coffee",
  "Vegetables", "Fruits", "Spices", "Fodder", "Other",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateProductPage() {
  const router = useRouter();
  const { categories, fetchCategories, categoriesLoading } = useProductCatalogStore();
  const [isSaving, setIsSaving] = useState(false);

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

  // Load categories on mount
  useEffect(() => {
    fetchCategories().catch(() => toast.error("Failed to load categories"));
  }, [fetchCategories]);

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

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
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

      const response = await apiClient.post<{ success: boolean; data: { id: string }; message?: string }>(
        "/products",
        payload,
      );

      toast.success(response.data.message ?? "Product created! Add variants and images next.");
      router.push("/dashboard/vendor/products");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string; errors?: Array<{ field: string; message: string }> } } };
      const msg = axiosError.response?.data?.message ?? "Failed to create product";
      toast.error(msg);
      // Map backend validation errors to form fields
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

  // Render category options (flatten tree for select)
  const flattenCategories = (cats: Category[], depth = 0): Array<{ id: string; label: string }> => {
    const result: Array<{ id: string; label: string }> = [];
    for (const cat of cats) {
      result.push({ id: cat.id, label: `${"—".repeat(depth)} ${cat.name}` });
      if (cat.children) result.push(...flattenCategories(cat.children, depth + 1));
    }
    return result;
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-2">
          <Link href="/dashboard/vendor/products" className="hover:text-emerald-700 dark:hover:text-emerald-400">My Products</Link>
          <span>/</span>
          <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">New Product</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
              <PackageSearch size={24} className="text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Create Product</h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                List a new agricultural product for sale
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

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
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
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20 ${
                  errors.categoryId ? "border-red-400 focus:border-red-500" : "border-gray-300 dark:border-gray-600 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400"
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
              placeholder="e.g., Organic DAP Fertilizer"
              className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 dark:focus:ring-offset-gray-800 ${
                errors.name ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : "border-gray-300 dark:border-gray-600 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.name}</p>}
          </div>

          {/* Name (Hindi) */}
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Product Name (हिन्दी) <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-normal">optional</span>
            </label>
            <input
              value={nameHi}
              onChange={(e) => setNameHi(e.target.value)}
              placeholder="e.g., ऑर्गेनिक डीएपी उर्वरक"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
            />
          </div>
        </div>

        {/* Description Card */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
          <h2 className="mb-5 text-base font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Description</h2>

          {/* Description (English) */}
          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Description (English) <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-normal">optional</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setErrors((prev) => ({ ...prev, description: "" })); }}
              rows={4}
              placeholder="Describe your product — ingredients, usage instructions, benefits..."
              className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 dark:focus:ring-offset-gray-800 resize-y ${
                errors.description ? "border-red-400 focus:border-red-500" : "border-gray-300 dark:border-gray-600 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
              }`}
            />
            <div className="mt-1 flex justify-between">
              {errors.description ? (
                <p className="text-xs text-red-500 dark:text-red-400">{errors.description}</p>
              ) : (
                <span />
              )}
              <span className={`text-xs ${description.length > 2000 ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500"}`}>
                {description.length}/2000
              </span>
            </div>
          </div>

          {/* Description (Hindi) */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Description (हिन्दी) <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-normal">optional</span>
            </label>
            <textarea
              value={descriptionHi}
              onChange={(e) => setDescriptionHi(e.target.value)}
              rows={3}
              placeholder="हिंदी में विवरण दर्ज करें..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none transition-all focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20 resize-y"
            />
          </div>
        </div>

        {/* Classification Card */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-sm dark:shadow-gray-950/30">
          <h2 className="mb-5 text-base font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Classification & Compliance</h2>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* HSN Code */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                HSN Code <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-normal">optional</span>
              </label>
              <input
                value={hsnCode}
                onChange={(e) => { setHsnCode(e.target.value); setErrors((prev) => ({ ...prev, hsnCode: "" })); }}
                placeholder="e.g., 310520"
                maxLength={8}
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 dark:focus:ring-offset-gray-800 font-mono ${
                  errors.hsnCode ? "border-red-400 focus:border-red-500" : "border-gray-300 dark:border-gray-600 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
                }`}
              />
              {errors.hsnCode && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.hsnCode}</p>}
            </div>

            {/* GST Rate */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                GST Rate (%) <span className="text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-normal">optional</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={gstRate}
                  onChange={(e) => { setGstRate(e.target.value); setErrors((prev) => ({ ...prev, gstRate: "" })); }}
                  placeholder="e.g., 18"
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

            {/* Unit of Measure */}
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

            {/* Seasonal Flag */}
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Mark if available only during specific seasons</p>
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

          {/* Common crops quick-add */}
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

          {/* Custom crop input */}
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

          {/* Selected crops */}
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
              Select crops this product is suitable for (optional, but helps farmers find your products)
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-950/30">
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
            {isSaving ? "Creating..." : "Create Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
