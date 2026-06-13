"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { clsx } from "@/lib/clsx";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Primary horizontal nav with active-state highlighting. Scrolls horizontally on
 * small screens instead of wrapping, so it never crowds the header. Admin items
 * are passed separated by a divider marker.
 */
export function AppNav({
  items,
  adminItems,
}: {
  items: NavItem[];
  adminItems: NavItem[];
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const link = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      className={clsx(
        "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        isActive(item.href)
          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
      )}
    >
      {item.label}
    </Link>
  );

  return (
    <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map(link)}
      {adminItems.length > 0 && (
        <span
          aria-hidden
          className="mx-1 h-5 w-px shrink-0 bg-zinc-200 dark:bg-zinc-700"
        />
      )}
      {adminItems.map(link)}
    </nav>
  );
}
