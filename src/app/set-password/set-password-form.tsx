"use client";

import { useActionState } from "react";

import { Card, Button, Input, Field, Alert } from "@/components/ui";
import type { Dict } from "@/lib/i18n/dictionaries";

import { setPassword, type SetPasswordState } from "./actions";

const initial: SetPasswordState = { ok: false, message: null };

/**
 * Public set-password form. Outside the I18nProvider — strings arrive via the
 * `dict` prop resolved by the server page (getDict), not useT().
 */
export function SetPasswordForm({ dict }: { dict: Dict["auth"] }) {
  const [state, formAction, pending] = useActionState(setPassword, initial);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <Field label={dict.newPassword} htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder={dict.newPasswordPlaceholder}
            required
            autoFocus
          />
        </Field>
        <Field label={dict.repeatPassword} htmlFor="confirm">
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
          {pending ? dict.savingPassword : dict.savePassword}
        </Button>
      </form>
    </Card>
  );
}
