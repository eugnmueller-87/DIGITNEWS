"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { clsx } from "@/lib/clsx";

export interface BottomNavItem {
  href: string;
  label: string;
  /** Icon key — keeps the icon set in one place (no icon dependency). */
  icon: BottomNavIcon;
}

export type BottomNavIcon =
  | "feed"
  | "meal"
  | "calendar"
  | "review"
  | "capture"
  | "members"
  | "more";

/** A raised, primary floating action — the staff capture button. */
export interface BottomNavFab {
  href: string;
  label: string;
  icon: BottomNavIcon;
}

/**
 * Phone-only bottom navigation: thumb-reachable primary destinations, fixed to
 * the bottom edge and clearing the home indicator (pb-safe). Hidden at >=sm,
 * where the top pill nav (AppNav) is the navigation. The top nav stays the
 * complete list on every breakpoint; this is the fast-path for the daily
 * destinations on a phone. Active state mirrors AppNav's prefix matching.
 *
 * `fab` (optional) renders the ONE primary action as a raised circular button
 * floating above the bar — used for staff capture, so "take a photo" is always
 * one obvious tap, distinct from the four destination tabs.
 */
export function BottomNav({
  items,
  fab,
}: {
  items: BottomNavItem[];
  fab?: BottomNavFab;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {fab && (
        <Link
          href={fab.href}
          aria-label={fab.label}
          className="rounded-wobble-pill fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center border-[3px] border-ink bg-sunshine text-ink shadow-felt transition-transform hover:-translate-y-0.5 active:translate-y-0.5 sm:hidden"
        >
          <Icon name={fab.icon} size={26} />
        </Link>
      )}
      <nav
        aria-label="Hauptnavigation"
        className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t-[3px] border-ink bg-paper/95 backdrop-blur sm:hidden"
      >
        <ul className="mx-auto flex max-w-3xl items-stretch justify-around">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    // 56px min target height = comfortable thumb tap.
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-bold",
                    active ? "text-ink" : "text-ink-soft",
                  )}
                >
                  <span
                    className={clsx(
                      "flex h-8 w-10 items-center justify-center rounded-full border-2 transition-colors",
                      active
                        ? "border-ink bg-sunshine"
                        : "border-transparent bg-transparent",
                    )}
                  >
                    <Icon name={item.icon} />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/** Inline stroke icons (currentColor) — no icon library dependency. */
function Icon({ name, size = 22 }: { name: BottomNavIcon; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "feed":
      return (
        <svg {...common}>
          <path d="M4 5h16M4 12h16M4 19h10" />
        </svg>
      );
    case "meal":
      return (
        <svg {...common}>
          <path d="M4 3v8a3 3 0 0 0 6 0V3M7 3v18M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4 2.5-1 2.5-4-1-5-2.5-5zM17 12v9" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M3 9h18M8 2v4M16 2v4" />
        </svg>
      );
    case "review":
      return (
        <svg {...common}>
          <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "capture":
      return (
        <svg {...common}>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );
    case "members":
      return (
        <svg {...common}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "more":
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1.4" />
          <circle cx="12" cy="12" r="1.4" />
          <circle cx="19" cy="12" r="1.4" />
        </svg>
      );
  }
}
