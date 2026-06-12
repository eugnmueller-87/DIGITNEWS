"use client";

import { useActionState } from "react";

import { Card, Button, Input, Field, Alert } from "@/components/ui";

import { submitApply, type ActionState } from "./actions";

const initial: ActionState = { ok: false, message: null };

/**
 * Public application form. Collects parent name, group, child name, email. On
 * success shows the "check your email" confirmation.
 */
export function ApplyForm({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState(submitApply, initial);

  if (state.ok) {
    return <Alert variant="success">{state.message}</Alert>;
  }

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="code" value={code} />

        <Field label="Dein Name (Elternteil)" htmlFor="parentName">
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

        <Field label="Gruppe" htmlFor="group">
          <Input
            id="group"
            name="group"
            type="text"
            maxLength={80}
            placeholder="z. B. Sonnengruppe"
            required
          />
        </Field>

        <Field label="Name des Kindes" htmlFor="childName">
          <Input
            id="childName"
            name="childName"
            type="text"
            maxLength={120}
            required
          />
        </Field>

        <Field label="Deine E-Mail-Adresse" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="du@beispiel.de"
            required
          />
        </Field>

        {state.message && <Alert variant="error">{state.message}</Alert>}

        <Button type="submit" disabled={pending}>
          {pending ? "Wird gesendet …" : "Zugang beantragen"}
        </Button>
        <p className="text-center text-xs text-zinc-400">
          Deine Anfrage wird von der Einrichtung geprüft und freigegeben.
        </p>
      </form>
    </Card>
  );
}
