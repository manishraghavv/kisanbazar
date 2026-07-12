"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

interface BackButtonProps {
  /** Fallback route if there's no browser history */
  fallbackRoute: string;
  /** Optional label override (defaults to "Back") */
  label?: string;
  /** Optional className override */
  className?: string;
  /** Optional callback after navigation */
  onNavigate?: () => void;
}

/**
 * Back button that uses browser history (router.back()) when available,
 * falling back gracefully to a specified route.
 * Handles the case where user landed directly on a page (no history).
 */
export function BackButton({
  fallbackRoute,
  label = "Back",
  className,
  onNavigate,
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onNavigate) {
      onNavigate();
      return;
    }
    // Try to go back in history; if there's no history (user refreshed/landed directly),
    // router.back() won't navigate anywhere, so we use the fallback.
    // We check if we can go back by seeing if there's a previous entry.
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackRoute);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500 transition-all",
        "hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200",
        "active:scale-95",
        className,
      )}
      aria-label={`Go back to ${fallbackRoute.split("/").pop() ?? "previous page"}`}
    >
      <ChevronLeft size={14} />
      {label}
    </button>
  );
}
