"use client";

import { useEffect } from "react";

import { clsx } from "@/lib/clsx";

/**
 * An iOS-style bottom sheet: a scrim + a panel that rises from the bottom edge,
 * rounded top corners, safe-area padded, dismissible by scrim tap or Escape.
 * Mount/unmount controlled by the parent via `open`. Respects reduced motion
 * (the slide is a transition, killed globally for those users).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Lock background scroll while the sheet is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div
      className={clsx(
        "fixed inset-0 z-50 sm:flex sm:items-center sm:justify-center",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      {/* Scrim */}
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className={clsx(
          "absolute inset-0 bg-ink/30 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
        tabIndex={open ? 0 : -1}
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          "pb-safe absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[20px] bg-paper shadow-float transition-transform duration-300 [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] sm:static sm:w-full sm:rounded-[20px] sm:pb-0",
          open ? "translate-y-0" : "translate-y-full sm:translate-y-0",
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-ink/15" />
        <div className="px-5 pb-5 pt-3">
          {title && (
            <h2 className="font-display mb-3 text-lg font-bold text-ink">
              {title}
            </h2>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
