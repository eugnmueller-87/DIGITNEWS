"use client";

import { useState, useTransition } from "react";

import { takedownPost } from "@/app/(app)/review/actions";
import { BottomSheet } from "@/components/bottom-sheet";
import {
  CategoryChip,
  CategoryGlyph,
  type ChipCategory,
} from "@/components/category-chip";
import { Icon } from "@/components/icons";
import { PostDetail } from "@/components/post-detail";
import { Alert } from "@/components/ui";
import { maskPlaceholders } from "@/lib/content/mask";

export interface FeedCardData {
  id: string;
  title: string | null;
  body: string | null;
  content_type: string | null;
  published_at: string | null;
  /** Structured extraction payload (typed per content_type) for the detail view. */
  payload?: unknown;
  /** Short-TTL signed URL of the (masked) photo, or null. Shown in the sheet. */
  imageUrl?: string | null;
}

/**
 * A tappable feed card: shows the category chip, title, and a 2-line preview;
 * tapping opens a bottom sheet with the FULL body (the list already has the
 * body in hand — no extra fetch). Event posts get a "Im Kalender" hint so the
 * member knows the date also lives in their subscribed calendar.
 */
export function FeedCard({
  post,
  isAdmin = false,
}: {
  post: FeedCardData;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEvent = post.content_type === "event_notice";
  // The Pinnwand now carries every content_type, so the chip reflects the real
  // category. health_notice is pinned separately as an alert (never a card here),
  // so it isn't in this map; null/unknown render as "info" (the routing contract).
  const CHIP_BY_TYPE: Record<string, ChipCategory> = {
    event_notice: "event_notice",
    meal_plan: "meal_plan",
    reflection: "reflection",
    info: "info",
  };
  const cat: ChipCategory = CHIP_BY_TYPE[post.content_type ?? ""] ?? "info";

  const dateLabel = post.published_at
    ? new Date(post.published_at).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
      })
    : null;

  function takedown() {
    setError(null);
    startTransition(async () => {
      const res = await takedownPost(post.id);
      if (res.ok) {
        setRemoved(true);
        setOpen(false);
      } else {
        setError(res.message);
        setConfirming(false);
      }
    });
  }

  // After a successful take-down, drop the card from the list immediately.
  if (removed) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press w-full rounded-[16px] border border-border bg-paper p-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          <CategoryGlyph category={cat} />
          <CategoryChip category={cat} />
          {dateLabel && (
            <span className="ml-auto shrink-0 text-[13px] font-semibold tabular-nums text-ink-faint">
              {dateLabel}
            </span>
          )}
        </div>
        <h2 className="mt-2.5 text-[17px] font-bold leading-snug text-ink">
          {post.title}
        </h2>
        {post.body && (
          <p className="mt-1 line-clamp-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">
            {maskPlaceholders(post.body)}
          </p>
        )}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <div className="flex items-center gap-2.5">
          <CategoryGlyph category={cat} />
          <CategoryChip category={cat} />
          {dateLabel && (
            <span className="ml-auto shrink-0 text-[13px] font-semibold tabular-nums text-ink-faint">
              {dateLabel}
            </span>
          )}
        </div>
        <h2 className="mt-3 font-display text-xl font-bold text-ink">
          {post.title}
        </h2>
        <div className="mt-2 max-h-[60vh] overflow-y-auto">
          {post.imageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element -- signed URL, not a static asset */
            <img
              src={post.imageUrl}
              alt={post.title ?? "Aushang"}
              loading="lazy"
              className="mb-3 w-full rounded-[12px] border border-border bg-surface-2 object-contain"
            />
          )}
          <PostDetail
            contentType={post.content_type}
            body={post.body}
            payload={post.payload}
          />
        </div>
        {isEvent && (
          <a
            href="/kalender"
            className="press mt-4 flex items-center justify-center gap-2 rounded-full bg-accent-soft py-3 font-bold text-accent-deep"
          >
            <Icon name="calendar" size={18} /> Im Kalender ansehen
          </a>
        )}

        {/* Admin-only: take this published post down (depublish). */}
        {isAdmin && (
          <div className="mt-4 border-t border-border pt-4">
            {error && (
              <div className="mb-2">
                <Alert variant="error">{error}</Alert>
              </div>
            )}
            {confirming ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={takedown}
                  disabled={pending}
                  className="press h-11 flex-1 rounded-full bg-tomato font-bold text-white disabled:opacity-50"
                >
                  {pending ? "Wird entfernt …" : "Wirklich entfernen"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                  className="press h-11 rounded-full border border-border px-5 font-bold text-ink-soft"
                >
                  Abbrechen
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="press flex w-full items-center justify-center gap-2 rounded-full border border-border py-2.5 font-bold text-tomato"
              >
                Aushang entfernen
              </button>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
