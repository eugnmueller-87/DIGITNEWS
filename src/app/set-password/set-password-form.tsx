"use client";

import { useActionState } from "react";

import { Card, Button, Input, Field, Alert } from "@/components/ui";

import { setPassword, type SetPasswordState } from "./actions";

const initial: SetPasswordState = { ok: false, message: null };

export function SetPasswordForm() {
  const [state, formAction, pending] = useActionState(setPassword, initial);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <Field label="Neues Passwort" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="mindestens 8 Zeichen"
            required
            autoFocus
          />
        </Field>
        <Field label="Passwort wiederholen" htmlFor="confirm">
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
        </Field>
        {state.message && <Alert variant="error">{state.message}</Alert>}
        <Button type="submit" disabled={pending}>
          {pending ? "Wird gespeichert …" : "Passwort speichern"}
        </Button>
      </form>
    </Card>
  );
}
