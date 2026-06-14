import Link from "next/link";

import { clsx } from "@/lib/clsx";

import { Icon, type IconName } from "./icons";

/**
 * iOS grouped-table primitives. A `Group` is an inset, hairline-bordered white
 * container; `Row` is a 56px-min tappable row (leading glyph + title/subtitle +
 * trailing chevron) with hairline separators between siblings. Used by the Mehr
 * hub, Einstellungen, and any settings-style list.
 */
export function Group({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      {title && (
        <h2 className="mb-2 px-1 text-[13px] font-bold uppercase tracking-[0.04em] text-ink-soft">
          {title}
        </h2>
      )}
      <div className="overflow-hidden rounded-[16px] border border-border bg-paper">
        {children}
      </div>
    </section>
  );
}

export function Row({
  href,
  glyph,
  title,
  subtitle,
  trailing,
  first = false,
}: {
  href: string;
  glyph?: IconName;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  first?: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "press flex min-h-14 items-center gap-3 px-4 py-2.5",
        !first && "border-t border-[color:var(--hairline)]",
      )}
    >
      {glyph && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-accent">
          <Icon name={glyph} size={18} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold text-ink">
          {title}
        </span>
        {subtitle && (
          <span className="block truncate text-sm text-ink-soft">
            {subtitle}
          </span>
        )}
      </span>
      {trailing}
      <Icon name="chevron" size={18} className="shrink-0 text-ink-faint" />
    </Link>
  );
}
