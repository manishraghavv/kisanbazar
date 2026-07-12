"use client";

import { useRef, useState } from "react";
import apiClient from "@/lib/api-client";
import { toast } from "sonner";
import { Upload, Download, Loader2, CheckCircle2, XCircle, X } from "lucide-react";

interface ImportResult {
  row: number;
  name: string;
  status: "created" | "skipped" | "error";
  reason?: string;
}

interface Props {
  onClose: () => void;
  onImported: () => void;
}

const CSV_TEMPLATE = [
  "name,description,category_slug,unit,sku,mrp,selling_price,stock",
  "Organic Turmeric,Fresh turmeric powder,spices,kg,TRM-001,250,220,100",
  "Basmati Rice,,grains,kg,BSM-001,150,135,500",
].join("\n");

export default function BulkImportModal({ onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; created: number; errors: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setResults(null);
    setSummary(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiClient.post<{
        success: boolean;
        summary: { total: number; created: number; errors: number };
        results: ImportResult[];
      }>("/products/bulk-import", form);

      setResults(res.data.results);
      setSummary(res.data.summary);

      if (res.data.summary.created > 0) {
        toast.success(`${res.data.summary.created} products imported`);
        onImported();
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-gray-800 shadow-2xl dark:shadow-gray-950/60 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Bulk Import Products</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Template download */}
          <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">CSV Template</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Download to see required columns & format</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition-colors"
            >
              <Download size={14} /> Download
            </button>
          </div>

          {/* Required columns info */}
          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 text-xs space-y-1">
            <p className="font-semibold text-blue-800 dark:text-blue-300">Required columns:</p>
            <p className="text-blue-700 dark:text-blue-400 font-mono">
              name, category_slug, sku, mrp, selling_price
            </p>
            <p className="font-semibold text-blue-800 dark:text-blue-300 mt-2">Optional:</p>
            <p className="text-blue-700 dark:text-blue-400 font-mono">description, unit, stock</p>
            <p className="text-blue-600 dark:text-blue-400 mt-2">Max 200 rows per file. All products are created as DRAFT.</p>
          </div>

          {/* Drop zone */}
          {!results && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f && f.name.endsWith(".csv")) setFile(f);
                else toast.error("Please drop a .csv file");
              }}
              onClick={() => fileRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors py-8 ${
                isDragOver
                  ? "border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                  : "border-gray-300 dark:border-gray-600 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              <Upload size={24} className="text-gray-400 dark:text-gray-500" />
              {file ? (
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Drag & drop CSV or <span className="text-emerald-600 dark:text-emerald-400">browse</span>
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Max 2 MB, .csv only</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); e.target.value = ""; }}
              />
            </div>
          )}

          {/* Results */}
          {results && summary && (
            <div className="space-y-3">
              {/* Summary bar */}
              <div className="flex gap-3 text-sm">
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={14} /> {summary.created} created
                </span>
                {summary.errors > 0 && (
                  <span className="flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-900/30 px-3 py-1 font-semibold text-red-700 dark:text-red-300">
                    <XCircle size={14} /> {summary.errors} failed
                  </span>
                )}
              </div>

              {/* Row results */}
              <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {results.map((r) => (
                  <div key={r.row} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 mt-0.5">R{r.row}</span>
                    <p className="flex-1 text-gray-800 dark:text-gray-200 truncate">{r.name}</p>
                    {r.status === "created" ? (
                      <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <div className="text-right">
                        <XCircle size={15} className="text-red-500 dark:text-red-400 shrink-0" />
                        <p className="text-xs text-red-500 dark:text-red-400">{r.reason}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => { setResults(null); setSummary(null); setFile(null); }}
                className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                Import another file
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {results ? "Close" : "Cancel"}
          </button>
          {!results && (
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Importing…</> : <><Upload size={16} /> Import</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
