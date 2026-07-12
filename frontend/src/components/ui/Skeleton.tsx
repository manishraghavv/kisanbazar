"use client";

import { cn } from "@/lib/cn";

interface SkeletonProps {
  /** Width of the skeleton (Tailwind class or arbitrary value) */
  className?: string;
  /** Number of skeleton rows to render */
  count?: number;
  /** Optional container className for multi-row skeletons */
  containerClassName?: string;
}

/**
 * Skeleton loading placeholder with a shimmer animation.
 * Use in place of spinners for a more polished loading experience.
 *
 * @example
 * // Single skeleton
 * <Skeleton className="h-4 w-48" />
 *
 * // List of skeletons
 * <Skeleton count={3} className="h-16 w-full" />
 */
export function Skeleton({ className, count = 1, containerClassName }: SkeletonProps) {
  if (count <= 1) {
    return (
      <div
        className={cn(
          "animate-shimmer rounded-lg bg-gradient-to-r from-gray-200 dark:from-gray-700 via-gray-100 dark:via-gray-600 to-gray-200 dark:to-gray-700 bg-[length:200%_100%]",
          className,
        )}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className={cn("space-y-3", containerClassName)} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-shimmer rounded-lg bg-gradient-to-r from-gray-200 dark:from-gray-700 via-gray-100 dark:via-gray-600 to-gray-200 dark:to-gray-700 bg-[length:200%_100%]",
            className,
          )}
        />
      ))}
    </div>
  );
}

/**
 * Product card skeleton placeholders (common pattern)
 */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Image placeholder */}
      <Skeleton className="aspect-[4/3] rounded-none" />
      {/* Content */}
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="mt-2 h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Table row skeleton for list views
 */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 border-b border-gray-100 dark:border-gray-700 px-4 py-3.5">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === 0 ? "w-1/3" : i === columns - 1 ? "w-1/6" : "w-1/5",
          )}
        />
      ))}
    </div>
  );
}

/**
 * Detail page skeleton for forms/profile pages
 */
export function DetailPageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back button placeholder */}
      <Skeleton className="h-6 w-16" />
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      {/* Content blocks */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
