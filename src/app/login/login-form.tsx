"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Card, Button, Input, Field, Alert } from "@/components/ui";
import type { Dict } from "@/lib/i18n/dictionaries";

import { signIn, type ActionState } from "./actions";

const initial: ActionState = { ok: false, message: null };

/**
 * Public login form. It lives OUTSIDE the (app) layout's I18nProvider, so it
 * can't call useT() — the strings it needs are passed in from the server page
 * (which resolves them via getDict) as a `dict` prop.
 */
export function LoginForm({ dict }: { dict: Dict["auth"] }) {
  const [state, formAction, pending] = useActionState(signIn, initial);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <Field label={dict.email} htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={dict.emailPlaceholder}
            required
            autoFocus
          />
        </Field>
        <Field label={dict.password} htmlFor="password">
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
          {pending ? dict.signingIn : dict.signIn}
        </Button>
        <p className="text-center text-sm font-semibold text-ink-soft">
          <Link href="/passwort-vergessen" className="underline">
            {dict.forgotPassword}
          </Link>
        </p>
      </form>
    </Card>
  );
}
