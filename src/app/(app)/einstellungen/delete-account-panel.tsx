"use client";

import { useState, useTransition } from "react";

import { Card, Alert, MiniButton } from "@/components/ui";
import type { Role } from "@/lib/database.types";

import { deleteOwnAccount } from "./actions";

/**
 * Account deletion (GDPR). Two-step confirm. The server flow refuses if the user
 * is the last admin of an org. Superadmins (operators) can't self-delete here.
 */
export function DeleteAccountPanel({
  role,
  warnLastAdmin,
}: {
  role: Role;
  warnLastAdmin: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (role === "superadmin") {
    return (
      <Card>
        <h2 className="font-display text-base font-semibold text-ink">
          Konto löschen
        </h2>
        <p className="mt-1 text-sm font-semibold text-ink-soft">
          Operator-Konten können hier nicht gelöscht werden.
        </p>
      </Card>
    );
  }

  function remove() {
    setError(null);
    start(async () => {
      const res = await deleteOwnAccount();
      // On success the action redirects; we only get here on error.
      if (res && !res.ok) {
        setError(res.message);
        setConfirming(false);
      }
    });
  }

  return (
    <Card className="border-tomato">
      <h2 className="font-display text-base font-semibold text-tomato">
        Konto löschen
      </h2>
      <p className="mt-1 text-sm font-semibold text-ink-soft">
        Dein Konto und deine persönlichen Daten werden dauerhaft gelöscht. Dies
        kann nicht rückgängig gemacht werden.
        {warnLastAdmin &&
          " Als Administrator:in kannst du dich nicht löschen, wenn du die einzige bist."}
      </p>

      {error && (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="mt-3">
        {confirming ? (
          <div className="flex gap-2">
            <MiniButton tone="danger" disabled={pending} onClick={remove}>
              {pending ? "Wird gelöscht …" : "Endgültig löschen"}
            </MiniButton>
            <MiniButton disabled={pending} onClick={() => setConfirming(false)}>
              Abbrechen
            </MiniButton>
          </div>
        ) : (
          <MiniButton onClick={() => setConfirming(true)}>
            Konto löschen
          </MiniButton>
        )}
      </div>
    </Card>
  );
}
