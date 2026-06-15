"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { clsx } from "@/lib/clsx";

import { Icon, type IconName } from "./icons";

export interface BottomNavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Optional numeric badge (e.g. pending drafts on Prüfen). */
  badge?: number;
}

/**
 * Phone-only bottom tab bar (hidden ≥sm, where AppNav is the nav). Frosted,
 * thumb-reachable, clears the home indicator (pb-safe). The active tab shows a
 * teal-soft pill behind the GLYPH only; everything inactive is ink-faint. A
 * numeric badge (the iOS app-badge idiom) marks pending work on a tab. Active
 * state mirrors AppNav's prefix matching. The capture FAB is rendered
 * separately by CaptureLauncher.
 */
export function BottomNav({
  items,
  ariaLabel,
}: {
  items: BottomNavItem[];
  ariaLabel: string;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      aria-label={ariaLabel}
      className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-border bg-paper/85 backdrop-blur-xl sm:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "press flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] font-bold",
                  active ? "text-ink" : "text-ink-faint",
                )}
              >
                <span
                  className={clsx(
                    "relative flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active ? "bg-accent-soft text-accent" : "text-ink-faint",
                  )}
                >
                  <Icon name={item.icon} size={22} />
                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute -right-0.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-tomato px-1 text-[10px] font-bold tabular-nums text-white">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
