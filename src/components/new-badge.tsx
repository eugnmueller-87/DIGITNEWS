/**
 * Small "new since last visit" count pill. Renders nothing when count <= 0, so
 * callers can drop it into a Row's trailing slot unconditionally.
 */
export function NewBadge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-[13px] font-bold tabular-nums text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
