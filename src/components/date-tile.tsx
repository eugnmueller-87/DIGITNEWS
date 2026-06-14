const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

/**
 * A compact calendar date tile (day numeral + month abbrev) — the shared visual
 * for calendar Liste rows AND feed Termin cards, so an event reads the same in
 * both places. Parses the ISO STRING (never `new Date(iso)`, which shifts the
 * day west of UTC).
 */
export function DateTile({ iso }: { iso: string }) {
  const [, m, d] = iso.split("-");
  return (
    <div className="font-display flex w-14 shrink-0 flex-col items-center rounded-[12px] bg-surface-2 py-1.5">
      <span className="text-2xl font-extrabold leading-none tabular-nums text-ink">
        {d}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wide text-accent">
        {MONTH_ABBR[Number(m) - 1]}
      </span>
    </div>
  );
}
