import Link from "next/link";
import { Sprout } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 md:flex-row">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Sprout size={16} className="text-emerald-600 dark:text-emerald-400" />
          <span>© {new Date().getFullYear()} Kisaan Bazaar. Rooted in Trust.</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/support" className="text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200">
            Help &amp; Support
          </Link>
          <Link href="/terms" className="text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200">
            Terms
          </Link>
          <Link href="/privacy" className="text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
