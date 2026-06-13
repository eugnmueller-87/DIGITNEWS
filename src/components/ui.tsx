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
        <h1 className="font-display flex items-center gap-3 text-2xl font-bold text-ink">
          {title}
          <span
            aria-hidden
            className="hidden h-1 flex-1 rounded bg-[repeating-linear-gradient(90deg,var(--ink)_0_14px,transparent_14px_26px)] opacity-25 sm:block"
          />
        </h1>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {subtitle && (
        <p className="mt-1 font-semibold text-ink-soft">{subtitle}</p>
      )}
    </div>
  );
}

/** A centered empty-state inside a dashed card. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-[28px] border-[3px] border-dashed border-ink-soft/60 bg-paper/60 px-6 py-10 text-center">
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
        "rounded-wobble-a border-[3px] border-ink bg-paper p-6 shadow-felt-sm",
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
        "rounded-wobble-pill font-display inline-flex h-11 w-full items-center justify-center border-[3px] border-ink bg-sunshine px-6 text-base font-semibold text-ink shadow-felt transition-transform hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50",
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
        "h-11 w-full rounded-2xl border-[3px] border-ink bg-white px-4 text-base font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-soft/60 focus:bg-sky/20",
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
    info: "bg-sky/40 border-ink text-ink",
    error: "bg-tomato/20 border-tomato text-ink",
    success: "bg-wool-mint/60 border-grass-deep text-ink",
  } as const;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={clsx(
        "rounded-2xl border-[3px] px-4 py-3 text-sm font-semibold",
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
