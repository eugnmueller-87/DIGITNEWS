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
        "font-display shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
        isActive(item.href)
          ? "border-transparent bg-sun-soft text-ink"
          : "border-border bg-paper text-ink hover:bg-sun-soft",
      )}
    >
      {item.label}
    </Link>
  );

  return (
    // Wrap pills onto multiple rows instead of scrolling, so every item — incl.
    // the operator's extra "Operator" pill — is always fully visible without a
    // cut-off button or horizontal scroll.
    <nav className="flex flex-wrap items-center gap-2 pb-1">
      {items.map(pill)}
      {adminItems.length > 0 && (
        <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />
      )}
      {adminItems.map(pill)}
    </nav>
  );
}
