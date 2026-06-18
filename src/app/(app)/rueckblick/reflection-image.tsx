"use client";

import { useState, useTransition } from "react";

import { removePostImages } from "@/app/(app)/review/actions";
import { Alert } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";

/**
 * The reflection photo on /rueckblick, plus the operator-only "remove image"
 * control. Rückblick renders posts in a bespoke Card (not FeedCard), so it never
 * inherited the superadmin remove-image button that /feed and the section feeds
 * already have. This brings it to parity: the operator can strip the photo off
 * ANY reflection from where it's actually shown, keeping the text/PostDetail
 * intact. Reuses the existing cross-org removePostImages action — no new authz.
 * Once removed, we hide the image locally (the post text stays on the card).
 */
export function ReflectionImage({
  postId,
  imageUrl,
  alt,
  isSuperadmin,
}: {
  postId: string;
  imageUrl: string;
  alt: string;
  isSuperadmin: boolean;
}) {
  const t = useT();
  const [removed, setRemoved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function removeImage() {
    setError(null);
    startTransition(async () => {
      const res = await removePostImages(postId);
      if (res.ok) {
        setRemoved(true);
      } else {
        setError(res.message);
        setConfirming(false);
      }
    });
  }

  if (removed) return null;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, not a static asset */}
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        className="mt-3 w-full rounded-[12px] border border-border bg-surface-2 object-contain"
      />

      {/* Operator-only: remove the image, keeping the reflection text. */}
      {isSuperadmin && (
        <div className="mt-3 border-t border-border pt-3">
          {error && (
            <div className="mb-2">
              <Alert variant="error">{error}</Alert>
            </div>
          )}
          {confirming ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={removeImage}
                disabled={pending}
                className="press h-11 flex-1 rounded-full bg-tomato font-bold text-white disabled:opacity-50"
              >
                {pending ? t.feed.removingImage : t.feed.confirmRemoveImage}
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
              {t.feed.removeImage}
            </button>
          )}
        </div>
      )}
    </>
  );
}
