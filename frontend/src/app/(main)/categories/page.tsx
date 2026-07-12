"use client";

import { useEffect, useState } from "react";
import apiClient from "@/lib/api-client";
import Link from "next/link";
import {
  ChevronRight,
  ChevronDown,
  FolderTree,
  Loader2,
  Package,
} from "lucide-react";
import type { Category } from "@/types/auth";
import { cn } from "@/lib/cn";

// ─── Recursive Category Node ─────────────────────────────────────────────────

function CategoryNode({
  category,
  depth = 0,
}: {
  category: Category;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = category.children && category.children.length > 0;

  return (
    <div>
      <Link
        href={category.slug ? `/categories/${category.id}` : "#"}
        className={cn(
          "group flex items-center gap-2 rounded-lg px-3 py-2.5 transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/20",
          depth === 0 ? "font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100" : "text-gray-700 dark:text-gray-200 dark:text-gray-200",
        )}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              setExpanded(!expanded);
            }}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse category" : "Expand category"}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-600 hover:text-gray-600 dark:hover:text-gray-300 dark:text-gray-300 dark:hover:text-gray-300"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        {category.iconUrl ? (
          <img
            src={category.iconUrl}
            alt=""
            className="h-5 w-5 rounded object-contain"
          />
        ) : (
          <FolderTree size={15} className="shrink-0 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500" />
        )}

        <span className="text-sm">{category.name}</span>

        {category.nameHi && (
          <span className="hidden text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 group-hover:inline sm:inline">
            ({category.nameHi})
          </span>
        )}

        {category._count && (
          <span className="ml-auto rounded-full bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
            {category._count.products ?? category._count.children ?? 0}
          </span>
        )}
      </Link>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="border-l border-gray-100 dark:border-gray-700 dark:border-gray-700 ml-[18px]">
          {category.children!.map((child) => (
            <CategoryNode
              key={child.id}
              category={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [tree, setTree] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    apiClient
      .get<{ success: boolean; data: Category[] }>("/categories/tree")
      .then((res) => {
        setTree(res.data.data);
      })
      .catch(() => {
        setError("Failed to load categories");
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Flatten tree to count total categories
  const countCategories = (nodes: Category[]): number => {
    let count = nodes.length;
    for (const node of nodes) {
      if (node.children) count += countCategories(node.children);
    }
    return count;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-700/50 dark:bg-gray-700/50">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50 dark:bg-emerald-900/50">
              <FolderTree size={24} className="text-emerald-700 dark:text-emerald-400 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                Product Categories
              </h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                Browse agricultural supplies by category
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-emerald-700 dark:text-emerald-400 dark:text-emerald-400" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/30 dark:bg-red-900/30">
              <Package size={28} className="text-red-300" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
              {error}
            </h3>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:hover:bg-gray-700/50"
            >
              Retry
            </button>
          </div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 dark:bg-emerald-900/30">
              <FolderTree size={28} className="text-emerald-300" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
              No categories yet
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Categories will appear here once they are created.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              <span>
                <strong className="text-gray-900 dark:text-gray-100 dark:text-gray-100">
                  {countCategories(tree)}
                </strong>{" "}
                categories
              </span>
              <span className="text-gray-300">|</span>
              <span>
                <strong className="text-gray-900 dark:text-gray-100 dark:text-gray-100">{tree.length}</strong> top-level
              </span>
            </div>

            {/* Tree View */}
            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 dark:border-gray-700 bg-white dark:bg-gray-800 dark:bg-gray-800 shadow-sm dark:shadow-gray-950/30">
              <div className="divide-y divide-gray-100 dark:divide-gray-700 dark:divide-gray-700">
                {tree.map((category) => (
                  <div key={category.id} className="py-1">
                    <CategoryNode category={category} depth={0} />
                  </div>
                ))}
              </div>
            </div>

            {/* Hint */}
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
              Click a category to view its products. Expand parent categories to
              explore subcategories.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
