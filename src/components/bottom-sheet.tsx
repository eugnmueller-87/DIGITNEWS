"use client";

import { useEffect } from "react";

/**
 * A responsive dialog: a centered modal card on desktop, a bottom sheet on
 * mobile. Scrim + panel; dismissible by scrim tap, the close button (desktop),
 * or Escape. Rendered ONLY while `open` (unmounted when closed) so closed sheets
 * can't paint/stack. Background scroll is locked while open.
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

  // Don't render anything when closed. Previously the overlay stayed mounted and,
  // on desktop, the panel's hide transform was overridden by `sm:translate-y-0` —
  // so every card's CLOSED sheet was painted at screen center, stacking them and
  // blocking dismissal. Unmounting when closed removes that whole class of bug.
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 sm:flex sm:items-center sm:justify-center"
      aria-hidden={false}
    >
      {/* Scrim — click to dismiss (works on mobile + desktop). */}
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
      />
      {/* Panel. On desktop it's a centered modal card; on mobile a bottom sheet.
          max-h + overflow so a tall post scrolls inside the card instead of
          overflowing the viewport. */}
      <div
        role="dialog"
        aria-modal="true"
        className="pb-safe absolute inset-x-0 bottom-0 mx-auto flex max-h-[92vh] max-w-md flex-col overflow-hidden rounded-t-[20px] bg-paper shadow-float sm:static sm:w-full sm:rounded-[20px] sm:pb-0"
      >
        {/* Mobile grabber (swipe affordance). */}
        <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-ink/15 sm:hidden" />
        {/* Close button — the clear dismiss affordance on desktop (where there's
            no swipe). Scrim-click and Escape also close. */}
        <button
          type="button"
          aria-label="Schließen"
          onClick={onClose}
          className="press absolute right-3 top-3 z-10 hidden h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-ink-soft hover:bg-border sm:flex"
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </button>
        {/* Scrollable content region (so a tall post scrolls inside the card). */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">
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
