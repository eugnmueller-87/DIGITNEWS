import { clsx } from "@/lib/clsx";

/** Minimal, dependency-light UI primitives. */

/** A page heading + optional subtitle, used at the top of each (app) page. */
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
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** A centered empty-state inside a card. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card className="border-dashed">
      <div className="flex flex-col items-center gap-1 py-10 text-center">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
          {title}
        </p>
        {hint && <p className="max-w-xs text-xs text-zinc-400">{hint}</p>}
      </div>
    </Card>
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
        "rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
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
        "inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200",
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
        "h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100",
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
        "mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300",
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
    info: "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800",
    error:
      "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
    success:
      "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900",
  } as const;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={clsx("rounded-xl border px-4 py-3 text-sm", styles[variant])}
    >
      {children}
    </div>
  );
}

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
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </main>
  );
}
