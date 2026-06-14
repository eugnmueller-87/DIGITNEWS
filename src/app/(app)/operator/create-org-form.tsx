"use client";

import { useActionState } from "react";

import { Card, Button, Input, Field, Label, Alert } from "@/components/ui";

import { createOrgWithAdmin, type ActionState } from "./actions";

const initial: ActionState = { ok: false, message: null };

/** Superadmin form: create an org and its first admin in one step. */
export function CreateOrgForm() {
  const [state, formAction, pending] = useActionState(
    createOrgWithAdmin,
    initial,
  );

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <Field label="Name der Organisation" htmlFor="orgName">
          <Input
            id="orgName"
            name="orgName"
            type="text"
            maxLength={120}
            placeholder="z. B. Kita Sonnenschein"
            required
          />
        </Field>

        <Field label="E-Mail der ersten Person" htmlFor="adminEmail">
          <Input
            id="adminEmail"
            name="adminEmail"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="person@beispiel.de"
            required
          />
        </Field>

        <Field label="Name der Person (optional)" htmlFor="adminName">
          <Input
            id="adminName"
            name="adminName"
            type="text"
            maxLength={80}
            placeholder="z. B. Anna Müller"
          />
        </Field>

        <div className="space-y-1.5">
          <Label htmlFor="role">Rolle</Label>
          <select
            id="role"
            name="role"
            defaultValue="admin"
            className="h-12 w-full rounded-[12px] border border-border bg-surface-2 px-4 text-ink outline-none focus:border-accent focus:bg-paper"
          >
            <option value="admin">Administrator:in</option>
            <option value="member">Mitglied (nur lesen)</option>
          </select>
          <p className="text-sm text-ink-soft">
            Jede Organisation braucht mindestens eine Administrator:in.
          </p>
        </div>

        {state.message && (
          <Alert variant={state.ok ? "success" : "error"}>
            {state.message}
          </Alert>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? "Wird angelegt …" : "Organisation anlegen"}
        </Button>
      </form>
    </Card>
  );
}
