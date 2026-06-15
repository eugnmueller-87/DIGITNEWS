"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Card, Button, Input, Field, Alert } from "@/components/ui";
import type { Dict } from "@/lib/i18n/dictionaries";

import { requestPasswordReset, type ForgotState } from "./actions";

const initial: ForgotState = { ok: false, message: null };

/**
 * Public forgot-password form. Outside the I18nProvider — strings arrive via the
 * `dict` prop resolved by the server page (getDict), not useT().
 */
export function ForgotForm({ dict }: { dict: Dict["auth"] }) {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initial,
  );

  return (
    <Card>
      {state.ok ? (
        <div className="space-y-3">
          <Alert variant="success">{state.message}</Alert>
          <Link
            href="/registrieren"
            className="font-display flex h-11 w-full items-center justify-center rounded-full bg-sunshine px-6 text-base font-semibold text-ink shadow-felt transition-colors hover:bg-sun-deep hover:text-white"
          >
            {dict.enterCode}
          </Link>
        </div>
      ) : (
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
          {state.message && <Alert variant="error">{state.message}</Alert>}
          <Button type="submit" disabled={pending}>
            {pending ? dict.sending : dict.requestLink}
          </Button>
          <p className="text-center text-sm font-semibold text-ink-soft">
            <Link href="/login" className="underline">
              {dict.backToLogin}
            </Link>
          </p>
        </form>
      )}
    </Card>
  );
}
