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
  Trash2,
  Star,
  Image as ImageIcon,
  Settings2,
  Layers,
  PackageSearch,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import type { ProductImage } from "@/types/auth";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ManageImagesPage() {
  const params = useParams();
  const productId = params.id as string;

  const { fetchProductById, isProductLoading } = useProductCatalogStore();

  const [productName, setProductName] = useState("");
  const [productStatus, setProductStatus] = useState("");
  const [productImage, setProductImage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Images list
  const [images, setImages] = useState<ProductImage[]>([]);
  const [isImagesLoading, setIsImagesLoading] = useState(false);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [sortOrder, setSortOrder] = useState("0");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Delete
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Setting primary
  const [isSettingPrimary, setIsSettingPrimary] = useState<string | null>(null);

  // Fetch product info
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const product = await fetchProductById(productId);
      setProductName(product.name);
      setProductStatus(product.status);
      setProductImage(product.images[0]?.imageUrl ?? "");
      setIsLoading(false);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load product");
      setIsLoading(false);
    }
  }, [productId, fetchProductById]);

  // Fetch images
  const loadImages = useCallback(async () => {
    setIsImagesLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: ProductImage[] }>(
        `/products/${productId}/images`
      );
      setImages(res.data.data);
    } catch {
      toast.error("Failed to load images");
    } finally {
      setIsImagesLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadData();
    loadImages();
  }, [loadData, loadImages]);

  // Add image
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");

    if (!imageUrl.trim()) {
      setAddError("Image URL is required");
      return;
    }

    setIsAdding(true);
    try {
      await apiClient.post(`/products/${productId}/images`, {
        imageUrl: imageUrl.trim(),
        isPrimary,
        sortOrder: Number(sortOrder),
      });
      toast.success("Image added");
      setImageUrl("");
      setIsPrimary(false);
      setSortOrder("0");
      setShowAddForm(false);
      await loadImages();
      await loadData(); // Refresh product to get updated primary image
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setAddError(axiosError.response?.data?.message ?? "Failed to add image");
    } finally {
      setIsAdding(false);
    }
  };

  // Set primary
  const handleSetPrimary = async (imageId: string) => {
    setIsSettingPrimary(imageId);
    try {
      await apiClient.put(`/products/${productId}/images/${imageId}/primary`);
      toast.success("Primary image updated");
      await loadImages();
      await loadData();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to set primary image");
    } finally {
      setIsSettingPrimary(null);
    }
  };

  // Delete image
  const handleDelete = async (imageId: string) => {
    if (!confirm("Delete this image? This cannot be undone.")) return;

    setIsDeleting(imageId);
    try {
      await apiClient.delete(`/products/${productId}/images/${imageId}`);
      toast.success("Image deleted");
      await loadImages();
      await loadData();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message ?? "Failed to delete image");
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

  const sortedImages = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-2">
          <Link href="/dashboard/vendor/products" className="hover:text-emerald-700 dark:hover:text-emerald-400">
            My Products
          </Link>
          <span>/</span>
          <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">Images: {productName}</span>
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
                {productStatus.replace(/_/g, " ")} · {images.length} image{images.length !== 1 ? "s" : ""}
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
        <span className="flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30 px-3.5 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 shadow-sm dark:shadow-gray-950/30">
          <ImageIcon size={14} />
          Images ({images.length})
        </span>
        <Link
          href={`/dashboard/vendor/products/${productId}/attributes`}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 shadow-sm dark:shadow-gray-950/30 hover:border-emerald-200 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
        >
          <Settings2 size={14} />
          Attributes
        </Link>
      </div>

      {/* Add Image Button */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow transition-all hover:bg-emerald-800"
        >
          <Plus size={16} />
          Add Image
        </button>
      </div>

      {/* Add Image Form */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-5 shadow-sm dark:shadow-gray-950/30"
        >
          <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Add New Image</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Image URL <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                value={imageUrl}
                onChange={(e) => { setImageUrl(e.target.value); setAddError(""); }}
                placeholder="https://example.com/image.jpg"
                className={`w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 dark:focus:ring-offset-gray-800 font-mono ${
                  addError ? "border-red-400 focus:border-red-500" : "border-gray-300 dark:border-gray-600 dark:border-gray-600 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20"
                }`}
              />
              {addError && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{addError}</p>}
            </div>

            {/* Preview */}
            {imageUrl.trim() && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 p-3">
                <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">Preview</p>
                <div className="flex items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 p-4">
                  <img
                    src={imageUrl.trim()}
                    alt="Preview"
                    className="max-h-40 max-w-full rounded-lg object-contain shadow-sm dark:shadow-gray-950/30"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                    onLoad={(e) => {
                      (e.target as HTMLImageElement).style.display = "block";
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Sort Order
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-24 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 dark:border-gray-600 text-emerald-700 dark:text-emerald-400 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">Set as primary</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-700 dark:border-gray-700 pt-4">
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setImageUrl(""); setAddError(""); }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isAdding}
                className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-bold text-white shadow transition-all hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAdding ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
                {isAdding ? "Adding..." : "Add Image"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Images Grid */}
      {isImagesLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" />
        </div>
      ) : sortedImages.length === 0 && !showAddForm ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 dark:border-gray-600 dark:border-gray-600 dark:border-gray-600 py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
            <ImageIcon size={28} className="text-gray-300" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">No images yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            Add product images to showcase your product
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-800 transition-colors"
          >
            <Plus size={15} />
            Add First Image
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedImages.map((image) => (
            <div
              key={image.id}
              className={`group relative overflow-hidden rounded-xl border bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30 ${
                image.isPrimary ? "border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-400" : "border-gray-200 dark:border-gray-700 dark:border-gray-700"
              }`}
            >
              {/* Image */}
              <div className="aspect-square bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
                <img
                  src={image.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = "none";
                    img.parentElement!.classList.add("flex", "items-center", "justify-center");
                    img.parentElement!.innerHTML =
                      '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-gray-300"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                  }}
                />
              </div>

              {/* Primary Badge */}
              {image.isPrimary && (
                <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow">
                  <Star size={10} className="fill-white" />
                  Primary
                </div>
              )}

              {/* Overlay Actions */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                {!image.isPrimary && (
                  <button
                    onClick={() => handleSetPrimary(image.id)}
                    disabled={isSettingPrimary === image.id}
                    className="rounded-lg bg-white dark:bg-gray-800 dark:bg-gray-800 px-3.5 py-2 text-xs font-bold text-gray-800 dark:text-gray-200 dark:text-gray-200 shadow transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400 disabled:opacity-50"
                    title="Set as primary"
                  >
                    {isSettingPrimary === image.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      "Set Primary"
                    )}
                  </button>
                )}
                <a
                  href={image.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-white dark:bg-gray-800 dark:bg-gray-800 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 shadow hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink size={14} />
                </a>
                <button
                  onClick={() => handleDelete(image.id)}
                  disabled={isDeleting === image.id}
                  className="rounded-lg bg-white dark:bg-gray-800 dark:bg-gray-800 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 shadow hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-900/30 hover:text-red-700 transition-colors disabled:opacity-50"
                  title="Delete image"
                >
                  {isDeleting === image.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>

              {/* Bottom Info */}
              <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 dark:border-gray-700 px-3 py-2">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  Sort: {image.sortOrder}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 font-mono truncate max-w-[180px]">
                  {image.id.slice(0, 12)}...
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
