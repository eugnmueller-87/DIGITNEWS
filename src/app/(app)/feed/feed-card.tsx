"use client";

import { useState } from "react";

import { BottomSheet } from "@/components/bottom-sheet";
import {
  CategoryChip,
  CategoryGlyph,
  type ChipCategory,
} from "@/components/category-chip";
import { Icon } from "@/components/icons";
import { PostDetail } from "@/components/post-detail";
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
export function FeedCard({ post }: { post: FeedCardData }) {
  const [open, setOpen] = useState(false);
  const isEvent = post.content_type === "event_notice";
  const cat: ChipCategory = isEvent ? "event_notice" : "info";

  const dateLabel = post.published_at
    ? new Date(post.published_at).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
      })
    : null;

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
      </BottomSheet>
    </>
  );
}
