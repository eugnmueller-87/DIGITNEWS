"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Card, Button, Input, Field, Alert } from "@/components/ui";

import { verifyCode, type RegisterState } from "./actions";

const initial: RegisterState = { ok: false, message: null };

export function RegisterForm({ presetEmail }: { presetEmail?: string }) {
  const [state, formAction, pending] = useActionState(verifyCode, initial);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <Field label="E-Mail-Adresse" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="du@beispiel.de"
            defaultValue={presetEmail}
            required
            autoFocus={!presetEmail}
          />
        </Field>
        <Field label="Code aus der E-Mail" htmlFor="code">
          <Input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-stelliger Code"
            required
            autoFocus={!!presetEmail}
          />
        </Field>
        {state.message && <Alert variant="error">{state.message}</Alert>}
        <Button type="submit" disabled={pending}>
          {pending ? "Wird geprüft …" : "Weiter"}
        </Button>
        <p className="text-center text-sm font-semibold text-ink-soft">
          <Link href="/passwort-vergessen" className="underline">
            Neuen Code anfordern
          </Link>
        </p>
      </form>
    </Card>
  );
}
