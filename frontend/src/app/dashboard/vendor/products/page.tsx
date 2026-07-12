"use client";

import { useEffect, useState } from "react";
import { useProductCatalogStore } from "@/stores/productCatalogStore";
import { toast } from "sonner";
import {
  PackageSearch,
  Loader2,
  Plus,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { ProductListItem } from "@/types/auth";

const AddProductModal = dynamic(() => import("@/components/vendor/AddProductModal"), {
  ssr: false,
});
const BulkImportModal = dynamic(() => import("@/components/vendor/BulkImportModal"), {
  ssr: false,
});

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700", text: "text-gray-700 dark:text-gray-200 dark:text-gray-200" },
  ACTIVE: { bg: "bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300" },
  INACTIVE: { bg: "bg-amber-50 dark:bg-amber-900/30 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300" },
  OUT_OF_STOCK: { bg: "bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30", text: "text-red-800" },
  DISCONTINUED: { bg: "bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50", text: "text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" },
};

export default function VendorProductsPage() {
  const { products, total, isLoading, fetchProducts } = useProductCatalogStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductListItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  useEffect(() => {
    const params: Record<string, string | number> = { page: currentPage, limit: 20 };
    if (search.trim()) params.search = search.trim();
    if (statusFilter) params.status = statusFilter;
    fetchProducts(params).catch(() => toast.error("Failed to load products"));
  }, [currentPage, search, statusFilter, fetchProducts]);

  const totalPagesNum = Math.ceil(total / 20);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Products</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{total} product{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Plus size={16} /> Bulk Import
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-800 transition-colors"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
          <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Search your products..." className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 dark:focus:ring-emerald-400/20" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:focus:border-emerald-400">
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="INACTIVE">Inactive</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
          <option value="DISCONTINUED">Discontinued</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400" /></div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30">
            <PackageSearch size={36} className="text-emerald-300" />
          </div>
          <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100">No products yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by adding your first product</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-800 transition-colors"
          >
            <Plus size={16} /> Create your first product listing
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {products.map(p => {
              const style = STATUS_STYLES[p.status] ?? { bg: "bg-gray-100 dark:bg-gray-700 dark:bg-gray-700", text: "text-gray-700 dark:text-gray-200 dark:text-gray-200" };
              const lowestPrice = p.variants.length > 0 ? Math.min(...p.variants.map(v => v.sellingPrice)) : 0;
              return (
                <div key={p.id} className="rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 p-4 shadow-sm dark:shadow-gray-950/30 transition-all hover:shadow-md dark:shadow-gray-950/30">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
                        {p.images[0]?.imageUrl ? <img src={p.images[0].imageUrl} alt="" className="h-full w-full object-cover" />
                          : <PackageSearch size={22} className="text-gray-300" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">{p.name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.bg} ${style.text}`}>{p.status}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">{p.category.name}{p.unitOfMeasure ? ` · ${p.unitOfMeasure}` : ""}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                          <span>{p.variants.length} variant{p.variants.length !== 1 ? "s" : ""}</span>
                          {lowestPrice > 0 && <span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">from {formatCurrency(lowestPrice)}</span>}
                          <span>{formatDate(p.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedProduct(p)}
                      className="shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 p-2 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400">
                      <Eye size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPagesNum > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage <= 1}
                className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"><ChevronLeft size={16} /></button>
              {Array.from({ length: Math.min(totalPagesNum, 5) }, (_, i) => {
                const start = Math.max(1, Math.min(currentPage - 2, totalPagesNum - 4));
                const p = start + i;
                if (p > totalPagesNum) return null;
                return <button key={p} onClick={() => setCurrentPage(p)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold ${p === currentPage ? "bg-emerald-700 text-white" : "text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"}`}>{p}</button>;
              })}
              <button onClick={() => setCurrentPage(p => Math.min(totalPagesNum, p+1))} disabled={currentPage >= totalPagesNum}
                className="rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-300 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50 dark:bg-gray-700/50 disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          )}
        </>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 dark:bg-gray-800 p-6 shadow-2xl dark:shadow-gray-950/50 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{selectedProduct.name}</h3>
              <div className="flex items-center gap-1">
                <Link href={`/products`} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30">
                  View in Catalog
                </Link>
                <button onClick={() => setSelectedProduct(null)} className="rounded-lg p-1 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-700 dark:bg-gray-700"><X size={18} /></button>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Status</span><span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{selectedProduct.status}</span></div>
              <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Category</span><span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{selectedProduct.category.name}</span></div>
              <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Vendor</span><span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{selectedProduct.vendor.businessName}</span></div>
              {selectedProduct.description && (
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><p className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300 mb-1">Description</p><p className="text-gray-900 dark:text-gray-100 dark:text-gray-100">{selectedProduct.description}</p></div>
              )}
              <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">HSN Code</span><span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{selectedProduct.hsnCode ?? "—"}</span></div>
              <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">GST</span><span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{selectedProduct.gstRate ? `${selectedProduct.gstRate}%` : "—"}</span></div>
              <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Unit</span><span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{selectedProduct.unitOfMeasure ?? "—"}</span></div>
              <div className="flex justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><span className="text-gray-600 dark:text-gray-300 dark:text-gray-300">Seasonal</span><span className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{selectedProduct.seasonalFlag ? "Yes" : "No"}</span></div>
              {selectedProduct.applicableCrops.length > 0 && (
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50 px-4 py-2.5"><p className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300 mb-1">Crops</p>
                  <div className="flex flex-wrap gap-1">{selectedProduct.applicableCrops.map(c => <span key={c} className="rounded-full bg-gray-200 dark:bg-gray-600 dark:bg-gray-600 px-2 py-0.5 text-[10px] text-gray-700 dark:text-gray-200 dark:text-gray-200">{c}</span>)}</div>
                </div>
              )}
              {selectedProduct.variants.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-wider">Variants ({selectedProduct.variants.length})</p>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700">
                    {selectedProduct.variants.map(v => (
                      <div key={v.id} className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">{v.variantName ?? "Default"}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">SKU: {v.sku}{v.weightGrams ? ` · ${v.weightGrams}g` : ""}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">{formatCurrency(v.sellingPrice)}</p>
                          {v.mrp > v.sellingPrice && <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 line-through">{formatCurrency(v.mrp)}</p>}
                          <p className={`text-[11px] ${v.stockQuantity > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                            {v.stockQuantity > 0 ? `${v.stockQuantity} in stock` : "Out of stock"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <AddProductModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            const params: Record<string, string | number> = { page: currentPage, limit: 20 };
            if (search.trim()) params.search = search.trim();
            if (statusFilter) params.status = statusFilter;
            fetchProducts(params).catch(() => {});
          }}
        />
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <BulkImportModal
          onClose={() => setShowBulkImport(false)}
          onImported={() => {
            const params: Record<string, string | number> = { page: 1, limit: 20 };
            if (search.trim()) params.search = search.trim();
            if (statusFilter) params.status = statusFilter;
            fetchProducts(params).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
