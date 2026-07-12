"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400", className)}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRight size={12} className="shrink-0 text-gray-300 dark:text-gray-600" />
            )}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-emerald-700 dark:hover:text-emerald-400"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "max-w-[200px] truncate",
                  isLast
                    ? "font-medium text-gray-900 dark:text-gray-100"
                    : "text-gray-500 dark:text-gray-400",
                )}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
