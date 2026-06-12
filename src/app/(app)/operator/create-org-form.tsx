"use client";

import { useActionState } from "react";

import { Card, Button, Input, Field, Label, Alert } from "@/components/ui";
import { ORG_TYPES } from "@/lib/validation";

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

        <div className="space-y-1.5">
          <Label htmlFor="orgType">Art der Organisation</Label>
          <select
            id="orgType"
            name="orgType"
            required
            defaultValue=""
            className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="" disabled>
              Bitte wählen …
            </option>
            {ORG_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <Field label="E-Mail der ersten Admin-Person" htmlFor="adminEmail">
          <Input
            id="adminEmail"
            name="adminEmail"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="admin@beispiel.de"
            required
          />
        </Field>

        <Field label="Name der Admin-Person (optional)" htmlFor="adminName">
          <Input
            id="adminName"
            name="adminName"
            type="text"
            maxLength={80}
            placeholder="z. B. Anna Müller"
          />
        </Field>

        {state.message && (
          <Alert variant={state.ok ? "success" : "error"}>
            {state.message}
          </Alert>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? "Wird angelegt …" : "Organisation + Admin anlegen"}
        </Button>
      </form>
    </Card>
  );
}
