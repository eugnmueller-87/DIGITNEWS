"use client";

import { useActionState, useState, useTransition } from "react";

import { Card, Button, Input, Field, Label, Alert } from "@/components/ui";
import { CONTENT_TYPES, CONTENT_TYPE_LABELS } from "@/lib/content/types";
import type { ContentType } from "@/lib/content/types";

import { publishDraft, discardDraft, type ReviewActionState } from "./actions";

const initial: ReviewActionState = { ok: false, message: null };

/**
 * One draft's review card: redacted photo (left/top) + editable extraction
 * (right/bottom). The admin confirms the content_type (pre-selected to the LLM
 * suggestion), edits title/body, then Publishes or Discards. The suggestion is
 * shown prominently; publishing is the ONLY path to member visibility.
 */
export function ReviewCard({
  id,
  title,
  body,
  suggested,
  imageUrl,
  failed = false,
}: {
  id: string;
  title: string | null;
  body: string | null;
  suggested: ContentType | null;
  imageUrl: string | null;
  failed?: boolean;
}) {
  const [state, formAction, publishing] = useActionState(publishDraft, initial);
  const [discarding, startDiscard] = useTransition();
  const [discardError, setDiscardError] = useState<string | null>(null);

  if (state.ok) {
    return (
      <Card>
        <Alert variant="success">{state.message}</Alert>
      </Card>
    );
  }

  function discard() {
    setDiscardError(null);
    startDiscard(async () => {
      const res = await discardDraft(id);
      if (!res.ok) setDiscardError(res.message);
    });
  }

  return (
    <Card>
      {failed && (
        <div className="mb-3">
          <Alert variant="error">
            Dieser Aushang konnte nicht automatisch ausgelesen werden. Du kannst
            ihn verwerfen und erneut fotografieren.
          </Alert>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element -- signed URL, not a static asset */
          <img
            src={imageUrl}
            alt="Ausschnitt des Aushangs (maskiert)"
            className="max-h-80 w-full rounded-xl border border-zinc-200 object-contain dark:border-zinc-800"
          />
        )}

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="postId" value={id} />

          <div className="space-y-1.5">
            <Label htmlFor={`ct-${id}`}>Art</Label>
            <select
              id={`ct-${id}`}
              name="contentType"
              defaultValue={suggested ?? "info"}
              className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {CONTENT_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  {CONTENT_TYPE_LABELS[ct]}
                  {ct === suggested ? " (Vorschlag)" : ""}
                </option>
              ))}
            </select>
          </div>

          <Field label="Titel" htmlFor={`title-${id}`}>
            <Input
              id={`title-${id}`}
              name="title"
              defaultValue={title ?? ""}
              maxLength={120}
              required
            />
          </Field>

          <div className="space-y-1.5">
            <Label htmlFor={`body-${id}`}>Text</Label>
            <textarea
              id={`body-${id}`}
              name="body"
              defaultValue={body ?? ""}
              maxLength={4000}
              rows={6}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          {state.message && <Alert variant="error">{state.message}</Alert>}
          {discardError && <Alert variant="error">{discardError}</Alert>}

          <div className="flex gap-2">
            {!failed && (
              <Button type="submit" disabled={publishing || discarding}>
                {publishing ? "Wird veröffentlicht …" : "Veröffentlichen"}
              </Button>
            )}
            <button
              type="button"
              onClick={discard}
              disabled={publishing || discarding}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 px-5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {discarding ? "…" : "Verwerfen"}
            </button>
          </div>
        </form>
      </div>
    </Card>
  );
}
