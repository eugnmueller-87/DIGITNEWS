"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Card, Button, Input, Field, Alert } from "@/components/ui";

import { requestPasswordReset, type ForgotState } from "./actions";

const initial: ForgotState = { ok: false, message: null };

export function ForgotForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initial,
  );

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
            {pending ? "Wird gesendet …" : "Link anfordern"}
          </Button>
          <p className="text-center text-sm font-semibold text-ink-soft">
            <Link href="/login" className="underline">
              Zurück zur Anmeldung
            </Link>
          </p>
        </form>
      )}
    </Card>
  );
}
