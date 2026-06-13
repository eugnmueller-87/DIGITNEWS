"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Card, Button, Input, Field, Alert } from "@/components/ui";

import { signIn, type ActionState } from "./actions";

const initial: ActionState = { ok: false, message: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initial);

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
            required
            autoFocus
          />
        </Field>
        <Field label="Passwort" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
        </Field>
        {state.message && <Alert variant="error">{state.message}</Alert>}
        <Button type="submit" disabled={pending}>
          {pending ? "Wird angemeldet …" : "Anmelden"}
        </Button>
        <p className="text-center text-sm font-semibold text-ink-soft">
          <Link href="/passwort-vergessen" className="underline">
            Passwort vergessen?
          </Link>
        </p>
      </form>
    </Card>
  );
}
