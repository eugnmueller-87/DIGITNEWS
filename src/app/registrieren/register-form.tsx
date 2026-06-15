"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Card, Button, Input, Field, Alert } from "@/components/ui";
import type { Dict } from "@/lib/i18n/dictionaries";

import { verifyCode, type RegisterState } from "./actions";

const initial: RegisterState = { ok: false, message: null };

/**
 * Public registration form. Outside the I18nProvider — strings arrive via the
 * `dict` prop resolved by the server page (getDict), not useT().
 */
export function RegisterForm({
  presetEmail,
  dict,
}: {
  presetEmail?: string;
  dict: Dict["auth"];
}) {
  const [state, formAction, pending] = useActionState(verifyCode, initial);

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
            defaultValue={presetEmail}
            required
            autoFocus={!presetEmail}
          />
        </Field>
        <Field label={dict.codeLabel} htmlFor="code">
          <Input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={dict.codePlaceholder}
            required
            autoFocus={!!presetEmail}
          />
        </Field>
        {state.message && <Alert variant="error">{state.message}</Alert>}
        <Button type="submit" disabled={pending}>
          {pending ? dict.checking : dict.next}
        </Button>
        <p className="text-center text-sm font-semibold text-ink-soft">
          <Link href="/passwort-vergessen" className="underline">
            {dict.requestNewCode}
          </Link>
        </p>
      </form>
    </Card>
  );
}
