"use client";

import { useActionState } from "react";

import { Card, Button, Input, Field, Label, Alert } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";

import { createOrgWithAdmin, type ActionState } from "./actions";

const initial: ActionState = { ok: false, message: null };

/** Superadmin form: create an org and its first admin in one step. */
export function CreateOrgForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState(
    createOrgWithAdmin,
    initial,
  );

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <Field label={t.operator.orgNameLabel} htmlFor="orgName">
          <Input
            id="orgName"
            name="orgName"
            type="text"
            maxLength={120}
            placeholder={t.operator.orgNamePlaceholder}
            required
          />
        </Field>

        <Field label={t.operator.firstEmailLabel} htmlFor="adminEmail">
          <Input
            id="adminEmail"
            name="adminEmail"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder={t.members.emailPlaceholder}
            required
          />
        </Field>

        <Field label={t.operator.firstNameLabel} htmlFor="adminName">
          <Input
            id="adminName"
            name="adminName"
            type="text"
            maxLength={80}
            placeholder={t.members.namePlaceholder}
          />
        </Field>

        <div className="space-y-1.5">
          <Label htmlFor="role">{t.members.role}</Label>
          <select
            id="role"
            name="role"
            defaultValue="admin"
            className="h-12 w-full rounded-[12px] border border-border bg-surface-2 px-4 text-ink outline-none focus:border-accent focus:bg-paper"
          >
            <option value="admin">{t.members.roleAdmin}</option>
            <option value="member">{t.members.roleMember}</option>
          </select>
          <p className="text-sm text-ink-soft">{t.operator.orgNote}</p>
        </div>

        {state.message && (
          <Alert variant={state.ok ? "success" : "error"}>
            {state.message}
          </Alert>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? t.operator.creating : t.operator.createOrg}
        </Button>
      </form>
    </Card>
  );
}
