"use client";

import { useState, useTransition } from "react";

import { removePostImages, takedownPost } from "@/app/(app)/review/actions";
import { BottomSheet } from "@/components/bottom-sheet";
import {
  CategoryChip,
  CategoryGlyph,
  type ChipCategory,
} from "@/components/category-chip";
import { Icon } from "@/components/icons";
import { PostDetail } from "@/components/post-detail";
import { Alert } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { maskPlaceholders } from "@/lib/content/mask";
import { formatDate } from "@/lib/i18n/format";
import { useLocale, useT } from "@/lib/i18n/provider";

export interface FeedCardData {
  id: string;
  title: string | null;
  body: string | null;
  content_type: string | null;
  published_at: string | null;
  /** health_notice severity (info|advisory|urgent) — picks the right chip when
   *  a health post is shown as a card (e.g. in the /gesundheit library). */
  health_severity?: string | null;
  /** Structured extraction payload (typed per content_type) for the detail view. */
  payload?: unknown;
  /** Short-TTL signed URL of the photo, or null. Shown in the sheet when present. */
  imageUrl?: string | null;
  /** Whether the post has ANY image in the DB (redacted/cover/source). Drives the
   *  superadmin "remove image" control — independent of whether a preview URL
   *  could be minted (a signed URL can be null even when an image exists). */
  hasImage?: boolean;
  /** Published since the member's last visit → highlighted until seen. */
  isNew?: boolean;
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
  isSuperadmin = false,
  autoOpen = false,
  tone = "default",
}: {
  post: FeedCardData;
  isAdmin?: boolean;
  isSuperadmin?: boolean;
  /** Deep-link: open this card's detail sheet on mount (e.g. /feed?post=<id>). */
  autoOpen?: boolean;
  /** "urgent" paints the card surface tomato — for pinned urgent health alerts
   *  at the top of the feed. Default cards are the calm paper surface. */
  tone?: "default" | "urgent";
}) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(autoOpen);
  const [confirming, setConfirming] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Superadmin image removal (separate from the takedown confirm flow).
  const [confirmingImage, setConfirmingImage] = useState(false);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [imagePending, startImageTransition] = useTransition();
  const isEvent = post.content_type === "event_notice";
  // The chip reflects the real category. On the Pinnwand, health_notice posts are
  // pinned separately as alerts — but in the category libraries (/gesundheit etc.)
  // they ARE shown as cards, so health_notice must map to a health chip (by
  // severity) rather than falling through to "info". null/unknown → "info".
  const CHIP_BY_TYPE: Record<string, ChipCategory> = {
    event_notice: "event_notice",
    meal_plan: "meal_plan",
    reflection: "reflection",
    info: "info",
  };
  const cat: ChipCategory =
    post.content_type === "health_notice"
      ? post.health_severity === "urgent"
        ? "health_urgent"
        : "health_advisory"
      : (CHIP_BY_TYPE[post.content_type ?? ""] ?? "info");
  const chipLabel = t.chip[cat];

  const dateLabel = post.published_at
    ? formatDate(post.published_at, locale, t, { noYear: true })
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

  function removeImage() {
    setError(null);
    startImageTransition(async () => {
      const res = await removePostImages(post.id);
      if (res.ok) {
        setImageRemoved(true); // hide the photo in the sheet; post text stays
        setConfirmingImage(false);
      } else {
        setError(res.message);
        setConfirmingImage(false);
      }
    });
  }

  // Show the photo preview only if we have a signed URL and it wasn't just removed.
  const showImage = !!post.imageUrl && !imageRemoved;
  // The superadmin "remove image" control depends on the post HAVING an image in
  // the DB — NOT on a preview URL being available (a signed URL can be null even
  // when an image exists, e.g. health alerts that skip signing). Falls back to the
  // URL presence if the flag wasn't passed.
  const canRemoveImage = (post.hasImage ?? !!post.imageUrl) && !imageRemoved;

  // After a successful take-down, drop the card from the list immediately.
  if (removed) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          "press w-full rounded-[16px] border p-4 text-left",
          // Urgent alerts get the tomato surface; the rest stay calm paper.
          tone === "urgent"
            ? "border-tomato bg-tomato-soft"
            : // New since the last visit → accent border until seen.
              post.isNew
              ? "border-accent bg-paper"
              : "border-border bg-paper",
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <CategoryGlyph category={cat} />
          <CategoryChip category={cat} label={chipLabel} />
          {post.isNew && (
            <span
              aria-label={t.feed.newBadge}
              className="size-2 shrink-0 rounded-full bg-accent"
            />
          )}
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
          <CategoryChip category={cat} label={chipLabel} />
          {dateLabel && (
            <span className="ml-auto shrink-0 text-[13px] font-semibold tabular-nums text-ink-faint">
              {dateLabel}
            </span>
          )}
        </div>
        <h2 className="mt-3 font-display text-xl font-bold text-ink">
          {post.title}
        </h2>
        <div className="mt-2">
          {showImage && (
            /* eslint-disable-next-line @next/next/no-img-element -- signed URL, not a static asset */
            <img
              src={post.imageUrl ?? ""}
              alt={post.title ?? t.feed.title}
              loading="lazy"
              className="mb-3 w-full rounded-[12px] border border-border bg-surface-2 object-contain"
            />
          )}
          <PostDetail
            contentType={post.content_type}
            body={post.body}
            payload={post.payload}
            dict={t}
            locale={locale}
          />
        </div>
        {isEvent && (
          <a
            href="/kalender"
            className="press mt-4 flex items-center justify-center gap-2 rounded-full bg-accent-soft py-3 font-bold text-accent-deep"
          >
            <Icon name="calendar" size={18} /> {t.feed.inCalendar}
          </a>
        )}

        {/* Superadmin-only: remove the image(s) from this post, keeping the text.
            Shown whenever the post HAS an image in the DB (even if no preview URL). */}
        {isSuperadmin && canRemoveImage && (
          <div className="mt-4 border-t border-border pt-4">
            {error && (
              <div className="mb-2">
                <Alert variant="error">{error}</Alert>
              </div>
            )}
            {confirmingImage ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={removeImage}
                  disabled={imagePending}
                  className="press h-11 flex-1 rounded-full bg-tomato font-bold text-white disabled:opacity-50"
                >
                  {imagePending
                    ? t.feed.removingImage
                    : t.feed.confirmRemoveImage}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingImage(false)}
                  disabled={imagePending}
                  className="press h-11 rounded-full border border-border px-5 font-bold text-ink-soft"
                >
                  {t.common.cancel}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingImage(true)}
                className="press flex w-full items-center justify-center gap-2 rounded-full border border-border py-2.5 font-bold text-tomato"
              >
                {t.feed.removeImage}
              </button>
            )}
          </div>
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
                  {pending ? t.feed.takingDown : t.feed.confirmTakedown}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                  className="press h-11 rounded-full border border-border px-5 font-bold text-ink-soft"
                >
                  {t.common.cancel}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="press flex w-full items-center justify-center gap-2 rounded-full border border-border py-2.5 font-bold text-tomato"
              >
                {t.feed.takedown}
              </button>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
