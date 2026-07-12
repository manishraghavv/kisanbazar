"use client";

import { useEffect, useRef, useState } from "react";
import { useProductCatalogStore } from "@/stores/productCatalogStore";
import { toast } from "sonner";
import {
  X,
  Plus,
  Loader2,
  ImagePlus,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import apiClient from "@/lib/api-client";
import type { Category } from "@/types/auth";

const inputCls =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3.5 py-2.5 text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20";

const labelCls =
  "mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400";

const UNITS = ["kg", "g", "litre", "ml", "piece", "dozen", "bundle", "bag", "box", "packet"];

const STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 5;

interface ImageEntry {
  localId: string;
  file: File;
  previewUrl: string;
  uploading: boolean;
  uploadedUrl: string | null;
  error: string | null;
}

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

function flattenCategories(cats: Category[], depth = 0): { id: string; label: string }[] {
  const result: { id: string; label: string }[] = [];
  for (const cat of cats) {
    result.push({ id: cat.id, label: " ".repeat(depth * 3) + cat.name });
    if (cat.children?.length) result.push(...flattenCategories(cat.children, depth + 1));
  }
  return result;
}

export default function AddProductModal({ onClose, onCreated }: Props) {
  const { fetchCategories, categories, createProduct, createVariant, addProductImage } =
    useProductCatalogStore();

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [mrp, setMrp] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [sku, setSku] = useState("");

  // Image entries
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [primaryIdx, setPrimaryIdx] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCategories().catch(() => toast.error("Failed to load categories"));
  }, [fetchCategories]);

  // Auto-generate SKU from name
  useEffect(() => {
    if (name) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSku(
        name
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 20) +
          "-" +
          Date.now().toString().slice(-4)
      );
    }
  }, [name]);

  const flatCategories = flattenCategories(categories);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Product name is required";
    if (!categoryId) e.categoryId = "Category is required";
    if (!mrp || isNaN(Number(mrp)) || Number(mrp) <= 0) e.mrp = "Valid MRP is required";
    if (!sellingPrice || isNaN(Number(sellingPrice)) || Number(sellingPrice) <= 0)
      e.sellingPrice = "Valid selling price is required";
    if (Number(sellingPrice) > Number(mrp))
      e.sellingPrice = "Selling price cannot exceed MRP";
    if (!stock || isNaN(Number(stock)) || Number(stock) < 0)
      e.stock = "Valid stock quantity is required";
    if (!sku.trim()) e.sku = "SKU is required";
    return e;
  }

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    const toAdd = arr.slice(0, remaining);
    const newEntries: ImageEntry[] = [];
    for (const file of toAdd) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: only JPG, PNG, WebP allowed`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: max 5 MB per image`);
        continue;
      }
      newEntries.push({
        localId: `${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        uploading: false,
        uploadedUrl: null,
        error: null,
      });
    }
    setImages((prev) => [...prev, ...newEntries]);
  }

  function removeImage(localId: string) {
    setImages((prev) => {
      const idx = prev.findIndex((i) => i.localId === localId);
      const next = prev.filter((i) => i.localId !== localId);
      if (primaryIdx >= idx && primaryIdx > 0) setPrimaryIdx((p) => p - 1);
      return next;
    });
  }

  async function uploadImage(entry: ImageEntry): Promise<string> {
    const form = new FormData();
    form.append("file", entry.file);
    // Do NOT set Content-Type manually — axios auto-sets multipart/form-data with the correct boundary
    const res = await apiClient.post<{ success: boolean; data: { url: string } }>("/upload", form);
    return res.data.data.url;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      // 1. Create product
      const product = await createProduct({
        categoryId,
        name: name.trim(),
        description: description.trim() || undefined,
        unitOfMeasure: unit || undefined,
      });

      // 2. Create default variant
      await createVariant(product.id, {
        sku: sku.trim(),
        mrp: Number(mrp),
        sellingPrice: Number(sellingPrice),
        stockQuantity: Number(stock),
      });

      // 3. Upload & attach images
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        try {
          setImages((prev) =>
            prev.map((x) => (x.localId === img.localId ? { ...x, uploading: true } : x))
          );
          const url = await uploadImage(img);
          await addProductImage(product.id, {
            imageUrl: url,
            isPrimary: i === primaryIdx,
            sortOrder: i,
          });
          setImages((prev) =>
            prev.map((x) =>
              x.localId === img.localId ? { ...x, uploading: false, uploadedUrl: url } : x
            )
          );
        } catch {
          setImages((prev) =>
            prev.map((x) =>
              x.localId === img.localId
                ? { ...x, uploading: false, error: "Upload failed" }
                : x
            )
          );
        }
      }

      // 4. If status is not DRAFT, update it
      if (status !== "DRAFT") {
        await apiClient.put(`/products/${product.id}`, { status });
      }

      toast.success("Product created successfully");
      onCreated();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? "Failed to create product");
    } finally {
      setSubmitting(false);
    }
  }

  const anyUploading = images.some((i) => i.uploading);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/60 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Add Product</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Name */}
          <div>
            <label className={labelCls}>Product Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Organic Turmeric Powder"
              className={inputCls}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe your product..."
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Category + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Category *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputCls}
              >
                <option value="">Select category</option>
                {flatCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.categoryId}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Unit</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
                <option value="">Select unit</option>
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* MRP + Selling Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>MRP (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
              {errors.mrp && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.mrp}</p>}
            </div>
            <div>
              <label className={labelCls}>Selling Price (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
              {errors.sellingPrice && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.sellingPrice}</p>
              )}
            </div>
          </div>

          {/* Stock + SKU */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Stock Quantity *</label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                className={inputCls}
              />
              {errors.stock && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.stock}</p>}
            </div>
            <div>
              <label className={labelCls}>SKU *</label>
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="AUTO-1234"
                className={`${inputCls} font-mono`}
              />
              {errors.sku && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.sku}</p>}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className={labelCls}>Status</label>
            <div className="flex gap-3">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    status === s.value
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Images */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={labelCls + " mb-0"}>
                Product Images ({images.length}/{MAX_IMAGES})
              </label>
              {images.length > 0 && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Click star to set cover
                </span>
              )}
            </div>

            {/* Drop zone */}
            {images.length < MAX_IMAGES && (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  addFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors py-6 ${
                  isDragOver
                    ? "border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                  <ImagePlus size={20} className="text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Drag & drop or <span className="text-emerald-600 dark:text-emerald-400">browse</span>
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">JPG, PNG, WebP · Max 5 MB each</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
                />
              </div>
            )}

            {/* Preview grid */}
            {images.length > 0 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {images.map((img, idx) => (
                  <div
                    key={img.localId}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                      idx === primaryIdx
                        ? "border-emerald-500 dark:border-emerald-400"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <img
                      src={img.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />

                    {/* Upload overlay */}
                    {img.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Loader2 size={16} className="animate-spin text-white" />
                      </div>
                    )}

                    {/* Error overlay */}
                    {img.error && (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-500/60">
                        <Upload size={14} className="text-white" />
                      </div>
                    )}

                    {/* Actions */}
                    {!img.uploading && (
                      <div className="absolute inset-0 flex items-end justify-between p-1 opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-t from-black/50 to-transparent">
                        <button
                          type="button"
                          onClick={() => setPrimaryIdx(idx)}
                          title="Set as cover"
                          className={`rounded p-0.5 ${
                            idx === primaryIdx
                              ? "text-yellow-400"
                              : "text-white/70 hover:text-yellow-400"
                          }`}
                        >
                          <Star size={13} fill={idx === primaryIdx ? "currentColor" : "none"} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(img.localId)}
                          className="rounded p-0.5 text-white/70 hover:text-red-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}

                    {/* Primary badge */}
                    {idx === primaryIdx && (
                      <span className="absolute left-1 top-1 rounded-sm bg-emerald-500 px-1 py-0.5 text-[9px] font-bold text-white leading-none">
                        COVER
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || anyUploading}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-800 disabled:opacity-50 transition-colors"
          >
            {submitting ? (
              <><Loader2 size={16} className="animate-spin" /> Creating...</>
            ) : (
              <><Plus size={16} /> Create Product</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
