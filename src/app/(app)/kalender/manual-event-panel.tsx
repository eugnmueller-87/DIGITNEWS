"use client";

import { useActionState, useState, useTransition } from "react";

import { Alert, Button, Card, Field, Input, Label } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { useT } from "@/lib/i18n/provider";
import { EVENT_CATEGORIES } from "@/lib/validation";

import {
  createManualEvent,
  updateManualEvent,
  deleteManualEvent,
  broadcastEvent,
  updateBroadcast,
  cancelBroadcast,
  type ReviewActionState,
} from "../review/actions";

export interface ManualEvent {
  id: string;
  org_id: string;
  title: string;
  category: "closure" | "event" | "deadline";
  starts_on: string;
  ends_on: string | null;
  all_day: boolean;
  time_start: string | null;
  time_end: string | null;
}

/** One broadcast collapsed to a single row (N per-org copies share these). */
export interface BroadcastEvent {
  broadcast_id: string;
  title: string;
  category: "closure" | "event" | "deadline";
  starts_on: string;
  ends_on: string | null;
  all_day: boolean;
  time_start: string | null;
  time_end: string | null;
  org_count: number;
}

const initial: ReviewActionState = { ok: false, message: null };

// The form drives one of three actions depending on mode.
type EditTarget =
  | { kind: "create" }
  | { kind: "event"; event: ManualEvent }
  | { kind: "broadcast"; broadcast: BroadcastEvent };

/**
 * Operator-only (superadmin) calendar management. Hand-enter a calendar event
 * for ONE org, or BROADCAST it to all orgs at once; plus edit/cancel existing
 * manual events and broadcasts. Members and org admins never see this — the page
 * gates it on isSuperadmin, the actions re-check requireSuperadmin(), and the
 * RPCs re-check the role. Events hang on invisible carrier posts (0027/0028), so
 * they show on the calendar but never on the Pinnwand.
 */
export function ManualEventPanel({
  orgs,
  events,
  broadcasts,
}: {
  orgs: { id: string; name: string }[];
  events: ManualEvent[];
  broadcasts: BroadcastEvent[];
}) {
  const t = useT();
  const m = t.calendar.manual;
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<EditTarget>({ kind: "create" });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setTarget({ kind: "create" });
          setOpen(true);
        }}
        className="press flex w-full items-center justify-center gap-2 rounded-[16px] border border-dashed border-border bg-paper py-3 font-bold text-ink-soft"
      >
        + {m.addButton}
      </button>
    );
  }

  return (
    <Card>
      <EventForm
        orgs={orgs}
        target={target}
        onClose={() => {
          setOpen(false);
          setTarget({ kind: "create" });
        }}
      />

      {broadcasts.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-border pt-4">
          <p className="text-sm font-bold text-ink-soft">
            {m.broadcastSection}
          </p>
          {broadcasts.map((b) => (
            <BroadcastRow
              key={b.broadcast_id}
              b={b}
              onEdit={() => setTarget({ kind: "broadcast", broadcast: b })}
            />
          ))}
        </div>
      )}

      {events.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-border pt-4">
          {events.map((ev) => (
            <EventRow
              key={ev.id}
              ev={ev}
              orgName={orgs.find((o) => o.id === ev.org_id)?.name ?? ev.org_id}
              onEdit={() => setTarget({ kind: "event", event: ev })}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function EventForm({
  orgs,
  target,
  onClose,
}: {
  orgs: { id: string; name: string }[];
  target: EditTarget;
  onClose: () => void;
}) {
  const t = useT();
  const m = t.calendar.manual;

  // Editing a broadcast vs an event vs creating. The create form additionally
  // offers a "release to all orgs" toggle that switches the submit action.
  const editingEvent = target.kind === "event" ? target.event : null;
  const editingBroadcast =
    target.kind === "broadcast" ? target.broadcast : null;
  const editing = editingEvent ?? editingBroadcast;

  const [broadcastMode, setBroadcastMode] = useState(
    target.kind === "broadcast",
  );

  const action = editingEvent
    ? updateManualEvent
    : editingBroadcast
      ? updateBroadcast
      : broadcastMode
        ? broadcastEvent
        : createManualEvent;

  const [state, formAction, pending] = useActionState(action, initial);
  const [allDay, setAllDay] = useState(editing?.all_day ?? true);

  const showOrgPicker = target.kind === "create" && !broadcastMode;

  return (
    <form action={formAction} className="space-y-3.5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-ink">
          {editing ? m.editTitle : m.newTitle}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-bold text-ink-soft"
        >
          {m.cancel}
        </button>
      </div>

      {editingEvent && (
        <input type="hidden" name="eventId" value={editingEvent.id} />
      )}
      {editingBroadcast && (
        <input
          type="hidden"
          name="broadcastId"
          value={editingBroadcast.broadcast_id}
        />
      )}

      {target.kind === "create" && (
        <label className="flex items-center gap-2.5 rounded-[12px] border border-border bg-surface-2 px-4 py-3 text-sm font-bold text-ink">
          <input
            type="checkbox"
            checked={broadcastMode}
            onChange={(e) => setBroadcastMode(e.target.checked)}
            className="h-5 w-5 rounded border-border"
          />
          {m.broadcastToggle}
        </label>
      )}

      {showOrgPicker && (
        <div className="space-y-1.5">
          <Label htmlFor="orgId">{m.org}</Label>
          <select
            id="orgId"
            name="orgId"
            required
            defaultValue=""
            className="h-12 w-full rounded-[12px] border border-border bg-surface-2 px-4 text-ink outline-none focus:border-accent focus:bg-paper"
          >
            <option value="" disabled>
              {m.orgPlaceholder}
            </option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <Field label={m.eventTitle} htmlFor="title">
        <Input
          id="title"
          name="title"
          type="text"
          maxLength={200}
          required
          defaultValue={editing?.title ?? ""}
        />
      </Field>

      <div className="space-y-1.5">
        <Label htmlFor="category">{m.categoryLabel}</Label>
        <select
          id="category"
          name="category"
          defaultValue={editing?.category ?? "event"}
          className="h-12 w-full rounded-[12px] border border-border bg-surface-2 px-4 text-ink outline-none focus:border-accent focus:bg-paper"
        >
          {EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t.calendar.category[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={m.startDate} htmlFor="startsOn">
          <Input
            id="startsOn"
            name="startsOn"
            type="date"
            required
            defaultValue={editing?.starts_on ?? ""}
          />
        </Field>
        <Field label={m.endDate} htmlFor="endsOn">
          <Input
            id="endsOn"
            name="endsOn"
            type="date"
            defaultValue={editing?.ends_on ?? ""}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2.5 text-sm font-bold text-ink">
        <input
          type="checkbox"
          name="allDay"
          value="1"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          className="h-5 w-5 rounded border-border"
        />
        {m.allDay}
      </label>

      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={m.startTime} htmlFor="timeStart">
            <Input
              id="timeStart"
              name="timeStart"
              type="time"
              defaultValue={editing?.time_start ?? ""}
            />
          </Field>
          <Field label={m.endTime} htmlFor="timeEnd">
            <Input
              id="timeEnd"
              name="timeEnd"
              type="time"
              defaultValue={editing?.time_end ?? ""}
            />
          </Field>
        </div>
      )}

      {state.message && (
        <Alert variant={state.ok ? "success" : "error"}>{state.message}</Alert>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? m.saving : m.save}
      </Button>
    </form>
  );
}

function EventRow({
  ev,
  orgName,
  onEdit,
}: {
  ev: ManualEvent;
  orgName: string;
  onEdit: () => void;
}) {
  const t = useT();
  return (
    <ManageRow
      title={ev.title}
      meta={`${ev.starts_on}${ev.ends_on ? ` – ${ev.ends_on}` : ""} · ${t.calendar.category[ev.category]} · ${orgName}`}
      onEdit={onEdit}
      onDelete={() => deleteManualEvent(ev.id)}
    />
  );
}

function BroadcastRow({
  b,
  onEdit,
}: {
  b: BroadcastEvent;
  onEdit: () => void;
}) {
  const t = useT();
  const m = t.calendar.manual;
  return (
    <ManageRow
      title={b.title}
      badge={`${m.broadcastBadge} · ${b.org_count}`}
      meta={`${b.starts_on}${b.ends_on ? ` – ${b.ends_on}` : ""} · ${t.calendar.category[b.category]}`}
      onEdit={onEdit}
      onDelete={() => cancelBroadcast(b.broadcast_id)}
    />
  );
}

/** Shared manage row: title + meta, an edit link, and a confirm-delete control. */
function ManageRow({
  title,
  meta,
  badge,
  onEdit,
  onDelete,
}: {
  title: string;
  meta: string;
  badge?: string;
  onEdit: () => void;
  onDelete: () => Promise<ReviewActionState>;
}) {
  const t = useT();
  const m = t.calendar.manual;
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [removed, setRemoved] = useState(false);

  if (removed) return null;

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await onDelete();
      if (res.ok) setRemoved(true);
      else {
        setError(res.message);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="rounded-[12px] border border-border bg-surface-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">
            {badge && (
              <span className="mr-2 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent-deep">
                {badge}
              </span>
            )}
            {title}
          </p>
          <p className="mt-0.5 text-[13px] text-ink-soft">{meta}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={pending}
            className="text-sm font-bold text-accent-deep"
          >
            {m.editTitle}
          </button>
          {confirming ? (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className={clsx(
                "text-sm font-bold text-tomato",
                pending && "opacity-50",
              )}
            >
              {pending ? m.deleting : m.confirmDelete}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-sm font-bold text-tomato"
            >
              {m.delete}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
    </div>
  );
}
