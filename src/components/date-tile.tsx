import type { Dict } from "@/lib/i18n/dictionaries";

/**
 * A compact calendar date tile (day numeral + month abbrev) — the shared visual
 * for calendar Liste rows AND feed Termin cards, so an event reads the same in
 * both places. Parses the ISO STRING (never `new Date(iso)`, which shifts the
 * day west of UTC). The month abbreviation is the first 3 letters of the
 * localized month name from the dict.
 */
export function DateTile({ iso, dict }: { iso: string; dict: Dict }) {
  const [, m, d] = iso.split("-");
  const monthName = dict.calendar.months[Number(m) - 1] ?? "";
  return (
    <div className="font-display flex w-14 shrink-0 flex-col items-center rounded-[12px] bg-surface-2 py-1.5">
      <span className="text-2xl font-extrabold leading-none tabular-nums text-ink">
        {d}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wide text-accent">
        {monthName.slice(0, 3)}
      </span>
    </div>
  );
}
