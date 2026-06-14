"use client";

import { useActionState, useState, useTransition } from "react";

import { Card, Button, Input, Alert, MiniButton } from "@/components/ui";

import {
  createGroupAction,
  renameGroupAction,
  deleteGroupAction,
  type MemberActionState,
} from "./member-actions";

const initial: MemberActionState = { ok: false, message: null };

interface GroupItem {
  id: string;
  name: string;
}

/** Admin panel to manage the org's groups (e.g. "Kita 1", "Kita 2"). */
export function GroupsPanel({ groups }: { groups: GroupItem[] }) {
  const [state, formAction, pending] = useActionState(
    createGroupAction,
    initial,
  );

  return (
    <Card>
      <h2 className="font-display text-base font-bold text-ink">Gruppen</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Lege die Gruppen deiner Einrichtung an (z. B. „Kita 1“, „Kita 2“) und
        weise Personen unten einer Gruppe zu.
      </p>

      {groups.length > 0 && (
        <ul className="mt-3 space-y-2">
          {groups.map((g) => (
            <GroupRow key={g.id} id={g.id} name={g.name} />
          ))}
        </ul>
      )}

      <form action={formAction} className="mt-3 flex flex-wrap gap-2">
        <Input
          name="name"
          placeholder="Neue Gruppe, z. B. Kita 1"
          maxLength={80}
          required
          className="min-w-40 flex-1"
        />
        <Button
          type="submit"
          disabled={pending}
          className="w-auto min-w-32 px-5"
        >
          {pending ? "Wird angelegt …" : "Hinzufügen"}
        </Button>
      </form>
      {state.message && (
        <div className="mt-2">
          <Alert variant={state.ok ? "success" : "error"}>
            {state.message}
          </Alert>
        </div>
      )}
    </Card>
  );
}

function GroupRow({ id, name }: { id: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      const res = await renameGroupAction(id, value);
      if (!res.ok) setError(res.message);
      else setEditing(false);
    });
  }
  function remove() {
    setError(null);
    start(async () => {
      const res = await deleteGroupAction(id);
      if (!res.ok) setError(res.message);
    });
  }

  return (
    <li>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editing ? (
          <>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={80}
              className="min-w-40 flex-1"
            />
            <div className="flex gap-2">
              <MiniButton
                type="button"
                tone="primary"
                disabled={pending}
                onClick={save}
              >
                Speichern
              </MiniButton>
              <MiniButton
                type="button"
                onClick={() => {
                  setEditing(false);
                  setValue(name);
                }}
              >
                Abbrechen
              </MiniButton>
            </div>
          </>
        ) : (
          <>
            <span className="rounded-[10px] bg-surface-2 px-3 py-1.5 font-semibold text-ink">
              {name}
            </span>
            <div className="flex gap-2">
              <MiniButton type="button" onClick={() => setEditing(true)}>
                Umbenennen
              </MiniButton>
              <MiniButton
                type="button"
                tone="danger"
                disabled={pending}
                onClick={remove}
              >
                Löschen
              </MiniButton>
            </div>
          </>
        )}
      </div>
      {error && (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
    </li>
  );
}
