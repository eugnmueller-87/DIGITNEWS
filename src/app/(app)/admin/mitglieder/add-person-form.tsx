"use client";

import { useActionState, useEffect, useRef } from "react";

import { Icon } from "@/components/icons";
import { Card, Button, Input, Field, Label, Alert } from "@/components/ui";

import { addPerson, type ActionState } from "./actions";

const initial: ActionState = { ok: false, message: null };

/** A Tafel-styled native select (rounded teal-focus well + custom chevron). */
function Select({
  id,
  name,
  defaultValue,
  children,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="h-12 w-full appearance-none rounded-[12px] border border-border bg-surface-2 px-4 pr-10 text-base font-medium text-ink outline-none focus:border-accent focus:bg-paper"
      >
        {children}
      </select>
      <Icon
        name="chevron"
        size={18}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-ink-faint"
      />
    </div>
  );
}

/**
 * Add-a-person form. Admins add members; superadmins may also choose 'admin'.
 * An optional "Gruppe" files the new member into a group immediately. On a
 * successful add the form remounts (keyed on a success counter) so the inputs
 * clear and the admin can add the next person without an accidental duplicate.
 */
export function AddPersonForm({
  canAddAdmins,
  groups,
}: {
  canAddAdmins: boolean;
  groups: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(addPerson, initial);
  // Clear the fields after a successful add (so the admin can add the next
  // person without an accidental duplicate). A DOM reset — no render cascade.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <Card>
      {state.message && (
        <div className="mb-4">
          <Alert variant={state.ok ? "success" : "error"}>
            {state.message}
          </Alert>
        </div>
      )}
      <form ref={formRef} action={formAction} className="space-y-4">
        <Field label="E-Mail-Adresse" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            inputMode="email"
            placeholder="person@beispiel.de"
            required
          />
        </Field>

        <Field label="Name (optional)" htmlFor="displayName">
          <Input
            id="displayName"
            name="displayName"
            type="text"
            maxLength={80}
            placeholder="z. B. Anna Müller"
          />
        </Field>

        {canAddAdmins && (
          <div className="space-y-1.5">
            <Label htmlFor="role">Rolle</Label>
            <Select id="role" name="role" defaultValue="member">
              <option value="member">Mitglied (nur lesen)</option>
              <option value="admin">Administrator:in</option>
            </Select>
          </div>
        )}
        {!canAddAdmins && <input type="hidden" name="role" value="member" />}

        {groups.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="groupId">Gruppe (optional)</Label>
            <Select id="groupId" name="groupId" defaultValue="">
              <option value="">Keine Gruppe</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? "Wird hinzugefügt …" : "Person hinzufügen"}
        </Button>
      </form>
    </Card>
  );
}
