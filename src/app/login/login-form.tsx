"use client";

import { useActionState } from "react";
import { requestLoginLink, type ActionState } from "./actions";
import { Card, Button, Input, Field, Alert } from "@/components/ui";

const initial: ActionState = { ok: false, message: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(requestLoginLink, initial);

  return (
    <Card>
      {state.ok ? (
        <Alert variant="success">{state.message}</Alert>
      ) : (
        <form action={formAction} className="space-y-4">
          <Field label="E-Mail-Adresse" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="du@beispiel.de"
              required
              autoFocus
            />
          </Field>
          {state.message && <Alert variant="error">{state.message}</Alert>}
          <Button type="submit" disabled={pending}>
            {pending ? "Wird gesendet …" : "Login-Link anfordern"}
          </Button>
        </form>
      )}
    </Card>
  );
}
