"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { clsx } from "@/lib/clsx";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Primary nav as wobbly "felt" pills with active-state highlighting. Scrolls
 * horizontally on small screens. Admin items separated by a divider.
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

  const pill = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      className={clsx(
        "rounded-wobble-pill font-display shrink-0 border-[3px] border-ink px-4 py-1.5 text-sm font-semibold shadow-felt-sm transition-transform hover:-translate-y-0.5",
        isActive(item.href)
          ? "bg-sunshine text-ink"
          : "bg-paper text-ink hover:bg-sunshine/60",
      )}
    >
      {item.label}
    </Link>
  );

  return (
    <nav className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map(pill)}
      {adminItems.length > 0 && (
        <span
          aria-hidden
          className="mx-1 h-6 w-0.5 shrink-0 rounded bg-ink/20"
        />
      )}
      {adminItems.map(pill)}
    </nav>
  );
}
