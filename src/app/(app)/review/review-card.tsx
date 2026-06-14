"use client";

import { useActionState, useState, useTransition } from "react";

import { Icon } from "@/components/icons";
import { Card, Button, Input, Field, Label, Alert } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { CONTENT_TYPES, CONTENT_TYPE_LABELS } from "@/lib/content/types";
import type { ContentType } from "@/lib/content/types";

import { publishDraft, discardDraft, type ReviewActionState } from "./actions";

const initial: ReviewActionState = { ok: false, message: null };

/**
 * One draft's review card. The masked photo sits on top (with a "Maskiert" trust
 * badge — surfacing the privacy-by-construction model), then the editable
 * extraction. The admin confirms the content_type by tapping a category chip;
 * the LLM's suggestion is PRE-SELECTED and tagged "Vorschlag". When the
 * suggestion is NULL we pre-select NOTHING and show no tag — forcing a
 * deliberate tap so a post can't be silently mis-routed. The selection writes
 * to a hidden `contentType` field, so publish_post stays deterministic.
 */
export function ReviewCard({
  id,
  title,
  body,
  suggested,
  imageUrl,
  clearPhotoAllowed = false,
  failed = false,
}: {
  id: string;
  title: string | null;
  body: string | null;
  suggested: ContentType | null;
  imageUrl: string | null;
  clearPhotoAllowed?: boolean;
  failed?: boolean;
}) {
  const [state, formAction, publishing] = useActionState(publishDraft, initial);
  const [discarding, startDiscard] = useTransition();
  const [discardError, setDiscardError] = useState<string | null>(null);
  // No pre-selection when there's no suggestion (forces a deliberate choice).
  const [selected, setSelected] = useState<ContentType | null>(suggested);
  // Per-post clear-photo release. Default OFF — members keep seeing the masked
  // image unless the admin deliberately releases the original here AND the
  // member opted into clear photos. Drives a deterministic hidden form field.
  const [clearPhoto, setClearPhoto] = useState(clearPhotoAllowed);

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

      {imageUrl && (
        <div className="relative mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, not a static asset */}
          <img
            src={imageUrl}
            alt="Ausschnitt des Aushangs (maskiert)"
            className="max-h-72 w-full rounded-[12px] border border-border bg-surface-2 object-contain"
          />
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink/70 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
            <Icon name="check" size={12} /> Maskiert
          </span>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="postId" value={id} />
        {/* The chip selection drives this deterministic form field. */}
        <input type="hidden" name="contentType" value={selected ?? ""} />
        {/* Per-post clear-photo release (deterministic; default off). */}
        <input
          type="hidden"
          name="clearPhotoAllowed"
          value={clearPhoto ? "1" : ""}
        />

        {!failed && (
          <div className="space-y-1.5">
            <Label>
              Art{" "}
              {suggested ? (
                <span className="font-normal text-ink-faint">
                  · Vorschlag der KI: {CONTENT_TYPE_LABELS[suggested]} — tippe
                  zum Ändern
                </span>
              ) : (
                <span className="font-normal text-ink-faint">
                  · tippe die passende Art an
                </span>
              )}
            </Label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map((ct) => {
                const active = selected === ct;
                return (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setSelected(ct)}
                    aria-pressed={active}
                    className={clsx(
                      "press inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-2 text-[13px] font-bold transition",
                      active
                        ? "border-accent bg-accent text-white shadow-sm"
                        : "border-border bg-paper text-ink-soft hover:bg-surface-2",
                    )}
                  >
                    {active && <Icon name="check" size={14} />}
                    {CONTENT_TYPE_LABELS[ct]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
            rows={5}
            className="w-full rounded-[12px] border border-border bg-surface-2 px-4 py-2.5 text-base font-medium text-ink outline-none focus:border-accent focus:bg-paper"
          />
        </div>

        {!failed && imageUrl && (
          <div className="flex items-start justify-between gap-4 rounded-[12px] border border-border bg-surface-2 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-ink">
                Originalfoto freigeben
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">
                Mitglieder, die klare Fotos aktiviert haben, sehen dann das
                unverpixelte Originalfoto statt der maskierten Version. Nur
                freigeben, wenn keine fremden Klarnamen darauf zu lesen sind.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={clearPhoto}
              onClick={() => setClearPhoto((v) => !v)}
              className={clsx(
                "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
                clearPhoto ? "bg-accent" : "bg-border",
              )}
            >
              <span
                className={clsx(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                  clearPhoto ? "translate-x-5" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
        )}

        {state.message && <Alert variant="error">{state.message}</Alert>}
        {discardError && <Alert variant="error">{discardError}</Alert>}

        <div className="flex gap-2">
          {!failed && (
            <Button
              type="submit"
              disabled={publishing || discarding || selected == null}
            >
              {publishing ? "Wird veröffentlicht …" : "Veröffentlichen"}
            </Button>
          )}
          <button
            type="button"
            onClick={discard}
            disabled={publishing || discarding}
            className="press inline-flex h-12 shrink-0 items-center justify-center rounded-full border border-border bg-paper px-5 text-base font-bold text-ink-soft transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            {discarding ? "…" : "Verwerfen"}
          </button>
        </div>
      </form>
    </Card>
  );
}
