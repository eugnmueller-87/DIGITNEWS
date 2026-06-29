import { clsx } from "@/lib/clsx";

import { Icon, type IconName } from "./icons";

/**
 * The single source of category color in the app. One chip, reused identically
 * across feed cards, the calendar Liste, and the review selector — so a parent
 * learns the five categories once and recognizes them everywhere. A soft-fill
 * pill + ink/tinted text + a leading tinted glyph-disc. Color is ALWAYS a soft
 * fill, never a saturated card background (health_notice urgency is the one
 * exception, handled at the card level).
 *
 * `info` and an unconfirmed NULL content_type render identically (the routing
 * contract: members never see the LLM's suggestion).
 */
export type ChipCategory =
  | "info"
  | "event_notice"
  | "meal_plan"
  | "reflection"
  | "health_advisory"
  | "health_urgent";

interface ChipStyle {
  fill: string; // chip background
  text: string; // chip text
  disc: string; // glyph-disc bg + text
  glyph: IconName;
}

const STYLES: Record<ChipCategory, ChipStyle> = {
  info: {
    fill: "bg-surface-2",
    text: "text-ink-soft",
    disc: "bg-surface-2 text-ink-soft",
    glyph: "info",
  },
  event_notice: {
    fill: "bg-sky-soft",
    text: "text-sky",
    disc: "bg-sky-soft text-sky",
    glyph: "calendar",
  },
  meal_plan: {
    fill: "bg-sage-soft",
    text: "text-sage",
    disc: "bg-sage-soft text-sage",
    glyph: "meal",
  },
  reflection: {
    fill: "bg-sun-soft",
    text: "text-sun-deep",
    disc: "bg-sun-soft text-sun-deep",
    glyph: "sun",
  },
  health_advisory: {
    fill: "bg-sun-soft",
    text: "text-sun-deep",
    disc: "bg-sun-soft text-sun-deep",
    glyph: "warning",
  },
  health_urgent: {
    fill: "bg-tomato",
    text: "text-white",
    disc: "bg-tomato text-white",
    glyph: "warning",
  },
};

/** The leading 32px tinted glyph-disc for a category (used on feed cards). */
export function CategoryGlyph({
  category,
  className,
}: {
  category: ChipCategory;
  className?: string;
}) {
  const s = STYLES[category];
  return (
    <span
      className={clsx(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        s.disc,
        className,
      )}
    >
      <Icon name={s.glyph} size={17} />
    </span>
  );
}

export function CategoryChip({
  category,
  label,
}: {
  category: ChipCategory;
  label: string;
}) {
  const s = STYLES[category];
  return (
    <span
      className={clsx(
        // min-w-0 + truncate so a long label yields space (e.g. to a date) on
        // narrow screens instead of pushing siblings off-screen.
        "inline-flex min-w-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold tracking-[0.01em]",
        s.fill,
        s.text,
      )}
    >
      <Icon name={s.glyph} size={13} />
      <span className="truncate">{label}</span>
    </span>
  );
}
