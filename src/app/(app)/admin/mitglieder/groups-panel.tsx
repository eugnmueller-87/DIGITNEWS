"use client";

import { useActionState, useState, useTransition } from "react";

import { Card, Button, Input, Alert } from "@/components/ui";

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
      <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Gruppen
      </h2>
      <p className="mt-1 text-xs text-zinc-400">
        Lege die Gruppen deiner Einrichtung an (z. B. „Kita 1“, „Kita 2“) und
        weise Personen unten einer Gruppe zu.
      </p>

      {groups.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {groups.map((g) => (
            <GroupRow key={g.id} id={g.id} name={g.name} />
          ))}
        </ul>
      )}

      <form action={formAction} className="mt-3 flex gap-2">
        <Input
          name="name"
          placeholder="Neue Gruppe, z. B. Kita 1"
          maxLength={80}
          required
          className="flex-1"
        />
        <Button type="submit" disabled={pending} className="w-auto px-4">
          {pending ? "…" : "Hinzufügen"}
        </Button>
      </form>
      {state.message && !state.ok && (
        <div className="mt-2">
          <Alert variant="error">{state.message}</Alert>
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
    <li className="flex items-center justify-between gap-2 text-sm">
      {editing ? (
        <>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={80}
            className="h-9 flex-1"
          />
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            Speichern
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setValue(name);
            }}
            className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-700"
          >
            Abbrechen
          </button>
        </>
      ) : (
        <>
          <span className="rounded-md bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
            {name}
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-zinc-500 underline"
            >
              Umbenennen
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="text-xs text-red-500 underline disabled:opacity-50"
            >
              Löschen
            </button>
          </span>
        </>
      )}
      {error && <span className="ml-2 text-xs text-red-500">{error}</span>}
    </li>
  );
}
