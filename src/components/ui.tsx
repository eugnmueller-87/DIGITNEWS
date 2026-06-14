import { clsx } from "@/lib/clsx";

/** Kita-themed UI primitives (felt-craft aesthetic; see globals.css tokens). */

/** A page heading + optional subtitle. Display font + dashed underline accent. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {subtitle && (
        <p className="mt-1 font-semibold text-ink-soft">{subtitle}</p>
      )}
    </div>
  );
}

/**
 * A loading placeholder block. Used by route-level loading.tsx files so a slow
 * server query shows an instant skeleton instead of a frozen/blank screen.
 * Decorative only (aria-hidden); the shimmer is disabled under
 * prefers-reduced-motion via the global rule in globals.css.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={clsx("skeleton rounded-2xl bg-ink/10", className)}
    />
  );
}

/** A skeleton shaped like a feed/section card (border + soft shadow). */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-[18px] border border-border bg-paper p-5 shadow-felt">
      <Skeleton className="h-5 w-2/3" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={i === lines - 1 ? "h-3 w-1/2" : "h-3 w-full"}
          />
        ))}
      </div>
    </div>
  );
}

/** A centered empty-state inside a dashed card. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-border bg-paper px-6 py-10 text-center">
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {hint && (
        <p className="mx-auto mt-1 max-w-xs text-sm font-semibold text-ink-soft">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-[18px] border border-border bg-paper p-6 shadow-felt",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Button({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "font-display inline-flex h-11 w-full items-center justify-center rounded-full bg-sunshine px-6 text-base font-semibold text-ink shadow-felt transition-colors hover:bg-sun-deep hover:text-white active:bg-sun-deep disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    />
  );
}

/**
 * A compact secondary action button for dense admin rows (promote, remove,
 * approve, copy …). Felt-themed and always ≥44px tall so it's a comfortable
 * thumb target on a phone. `tone` picks the fill; `danger` is for destructive
 * confirmations.
 */
export function MiniButton({
  tone = "neutral",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "neutral" | "primary" | "danger";
}) {
  const tones = {
    neutral: "border-border bg-paper text-ink hover:bg-sun-soft",
    primary:
      "border-transparent bg-sunshine text-ink hover:bg-sun-deep hover:text-white",
    danger: "border-transparent bg-tomato text-white",
  } as const;
  return (
    <button
      {...props}
      className={clsx(
        "font-display inline-flex h-11 min-h-11 items-center justify-center rounded-full border px-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        tones[tone],
        className,
      )}
    />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "h-11 w-full rounded-[12px] border border-border bg-white px-4 text-base font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-soft/60 focus:border-sun-deep",
        className,
      )}
    />
  );
}

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={clsx(
        "font-display mb-1.5 block font-semibold text-ink",
        className,
      )}
    />
  );
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function Alert({
  variant = "info",
  children,
}: {
  variant?: "info" | "error" | "success";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-sky/40 border-border text-ink",
    error: "bg-tomato/15 border-tomato text-ink",
    success: "bg-sage-soft border-border text-ink",
  } as const;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={clsx(
        "rounded-[12px] border px-4 py-3 text-sm font-semibold",
        styles[variant],
      )}
    >
      {children}
    </div>
  );
}

/** Centered card shell for auth/standalone pages (login, apply, etc.). */
export function PageShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      {title && (
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl font-bold text-ink">{title}</h1>
          {subtitle && (
            <p className="mt-1.5 font-semibold text-ink-soft">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </main>
  );
}
