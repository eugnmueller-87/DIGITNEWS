"use client";

import { useState, useTransition } from "react";

import { Card, Alert } from "@/components/ui";
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
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Konto löschen
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
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
    <Card className="border-red-200 dark:border-red-900/60">
      <h2 className="text-sm font-medium text-red-700 dark:text-red-400">
        Konto löschen
      </h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
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
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "Wird gelöscht …" : "Endgültig löschen"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Konto löschen
          </button>
        )}
      </div>
    </Card>
  );
}
