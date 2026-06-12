"use client";

import { useActionState } from "react";
import { submitJoin, type ActionState } from "./actions";
import { Card, Button, Input, Field, Alert } from "@/components/ui";

const initial: ActionState = { ok: false, message: null };

export function JoinForm({
  code,
  requiresApproval,
}: {
  code: string;
  requiresApproval: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitJoin, initial);

  if (state.ok) {
    return (
      <Alert variant={state.pendingApproval ? "info" : "success"}>
        {state.message}
      </Alert>
    );
  }

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="code" value={code} />
        <Field label="Deine E-Mail-Adresse" htmlFor="email">
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
          {pending
            ? "Wird gesendet …"
            : requiresApproval
              ? "Beitritt anfragen"
              : "Beitreten"}
        </Button>
        {requiresApproval && (
          <p className="text-center text-xs text-zinc-400">
            Deine Anfrage wird von der Organisation freigegeben.
          </p>
        )}
      </form>
    </Card>
  );
}
