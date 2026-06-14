"use client";

import { useActionState } from "react";

import { Card, Button, Input, Field, Label, Alert } from "@/components/ui";

import { addPerson, type ActionState } from "./actions";

const initial: ActionState = { ok: false, message: null };

/**
 * Add-a-person form. Admins add members; superadmins may also choose 'admin'.
 * On success the form resets via the keyed remount (success message shown).
 */
export function AddPersonForm({ canAddAdmins }: { canAddAdmins: boolean }) {
  const [state, formAction, pending] = useActionState(addPerson, initial);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
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
            <select
              id="role"
              name="role"
              defaultValue="member"
              className="h-12 w-full rounded-[12px] border border-border bg-surface-2 px-4 text-base font-medium text-ink outline-none focus:border-accent focus:bg-paper"
            >
              <option value="member">Mitglied (nur lesen)</option>
              <option value="admin">Administrator:in</option>
            </select>
          </div>
        )}
        {!canAddAdmins && <input type="hidden" name="role" value="member" />}

        {state.message && (
          <Alert variant={state.ok ? "success" : "error"}>
            {state.message}
          </Alert>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? "Wird hinzugefügt …" : "Person hinzufügen"}
        </Button>
      </form>
    </Card>
  );
}
