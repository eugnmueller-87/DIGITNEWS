"use client";

import { useActionState } from "react";
import { requestOrgCreation, type ActionState } from "./actions";
import { Card, Button, Input, Field, Label, Alert } from "@/components/ui";
import { ORG_TYPES } from "@/lib/validation";

const initial: ActionState = { ok: false, message: null };

export function StartForm() {
  const [state, formAction, pending] = useActionState(
    requestOrgCreation,
    initial,
  );

  if (state.ok) {
    return <Alert variant="success">{state.message}</Alert>;
  }

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <Field label="Name der Organisation" htmlFor="orgName">
          <Input
            id="orgName"
            name="orgName"
            type="text"
            placeholder="z. B. Kita Sonnenschein"
            maxLength={120}
            required
            autoFocus
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

        <Field label="Deine E-Mail-Adresse" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="du@beispiel.de"
            required
          />
        </Field>

        {state.message && <Alert variant="error">{state.message}</Alert>}

        <Button type="submit" disabled={pending}>
          {pending ? "Wird gesendet …" : "Bestätigungs-Link anfordern"}
        </Button>
        <p className="text-center text-xs text-zinc-400">
          Du wirst Administrator:in dieser Organisation.
        </p>
      </form>
    </Card>
  );
}
