import { clsx } from "@/lib/clsx";

import { SunLogo } from "./sun-logo";

/**
 * "Tafel" UI primitives — a quiet, paper-white iOS surface. Monochrome base,
 * one teal accent (--accent), hairline borders, one-elevation rule (resting
 * cards are border-only; real elevation is reserved for floating things).
 * Fredoka (font-display) is reserved for H1 + big numerals; body text is
 * Nunito at the base weight. See globals.css for tokens.
 */

/** A page heading + optional subtitle. */
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
        <h1 className="font-display text-[26px] font-bold leading-tight text-ink">
          {title}
        </h1>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {subtitle && <p className="mt-1 text-ink-soft">{subtitle}</p>}
    </div>
  );
}

/** An uppercase section header (iOS grouped-list style). */
export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 px-1 text-[13px] font-bold uppercase tracking-[0.04em] text-ink-soft">
      {children}
    </h2>
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
      className={clsx("skeleton rounded-[12px] bg-ink/[0.06]", className)}
    />
  );
}

/** A skeleton shaped like a feed/section card (border-only, no shadow). */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-[16px] border border-border bg-paper p-4">
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

/**
 * A centered empty-state: the (static) sun mark as a quiet marker, a title, and
 * an optional hint. Replaces the dashed box — the artwork IS the empty signal.
 */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <SunLogo className="mb-4 h-14 w-14 opacity-40 grayscale" />
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      {hint && (
        <p className="mx-auto mt-1.5 max-w-xs text-[15px] text-ink-soft">
          {hint}
        </p>
      )}
      {action && <div className="mt-5 w-full max-w-xs">{action}</div>}
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
        "rounded-[16px] border border-border bg-paper p-4",
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
        "press inline-flex h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-base font-bold text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    />
  );
}

/**
 * A compact secondary action button for dense admin rows (promote, remove,
 * approve, copy …). Always ≥44px tall so it's a comfortable thumb target.
 * `tone` picks the fill; `danger` is for destructive confirmations.
 */
export function MiniButton({
  tone = "neutral",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "neutral" | "primary" | "danger";
}) {
  const tones = {
    neutral: "border-border bg-paper text-ink hover:bg-surface-2",
    primary: "border-transparent bg-accent text-white hover:bg-accent-deep",
    danger: "border-transparent bg-tomato text-white",
  } as const;
  return (
    <button
      {...props}
      className={clsx(
        "press inline-flex h-11 min-h-11 items-center justify-center rounded-full border px-4 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
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
        "h-12 w-full rounded-[12px] border border-border bg-surface-2 px-4 text-base font-medium text-ink outline-none placeholder:text-ink-faint focus:border-accent focus:bg-paper",
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
      className={clsx("mb-1.5 block text-sm font-bold text-ink", className)}
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
    info: "bg-surface-2 border-border text-ink",
    error: "bg-tomato-soft border-tomato text-ink",
    success: "bg-sage-soft border-sage/40 text-ink",
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
          {subtitle && <p className="mt-1.5 text-ink-soft">{subtitle}</p>}
        </div>
      )}
      {children}
    </main>
  );
}
