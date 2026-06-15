"use client";

import { useActionState } from "react";

import { Card, Button, Input, Field, Alert } from "@/components/ui";
import type { Dict } from "@/lib/i18n/dictionaries";

import { submitApply, type ActionState } from "./actions";

const initial: ActionState = { ok: false, message: null };

/**
 * Public application form. Collects parent name, group, child name, email. On
 * success shows the "check your email" confirmation. Outside the I18nProvider —
 * strings arrive via the `dict` prop resolved by the server page (getDict).
 */
export function ApplyForm({
  code,
  dict,
}: {
  code: string;
  dict: Dict["auth"];
}) {
  const [state, formAction, pending] = useActionState(submitApply, initial);

  if (state.ok) {
    return <Alert variant="success">{state.message}</Alert>;
  }

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="code" value={code} />

        <Field label={dict.applyParentName} htmlFor="parentName">
          <Input
            id="parentName"
            name="parentName"
            type="text"
            maxLength={120}
            autoComplete="name"
            required
            autoFocus
          />
        </Field>

        <Field label={dict.applyGroup} htmlFor="group">
          <Input
            id="group"
            name="group"
            type="text"
            maxLength={80}
            placeholder={dict.applyGroupPlaceholder}
            required
          />
        </Field>

        <Field label={dict.applyChildName} htmlFor="childName">
          <Input
            id="childName"
            name="childName"
            type="text"
            maxLength={120}
            required
          />
        </Field>

        <Field label={dict.applyEmail} htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={dict.emailPlaceholder}
            required
          />
        </Field>

        {state.message && <Alert variant="error">{state.message}</Alert>}

        <Button type="submit" disabled={pending}>
          {pending ? dict.sending : dict.applySubmit}
        </Button>
        <p className="text-center text-xs text-zinc-400">{dict.applyNote}</p>
      </form>
    </Card>
  );
}
