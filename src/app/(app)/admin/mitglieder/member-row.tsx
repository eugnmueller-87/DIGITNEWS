"use client";

import { useState, useTransition } from "react";
import { removePersonAction } from "./actions";
import { Card, Alert } from "@/components/ui";
import type { Role, MembershipStatus } from "@/lib/database.types";

const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Operator",
  admin: "Admin",
  member: "Mitglied",
};

/**
 * One member row: name, role badge, invited/active status, and (when permitted)
 * a remove control. Removal uses a transition; the action revalidates the page.
 */
export function MemberRow({
  id,
  role,
  status,
  displayName,
  isSelf,
  canRemove,
}: {
  id: string;
  role: Role;
  status: MembershipStatus;
  displayName: string | null;
  isSelf: boolean;
  canRemove: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await removePersonAction(id);
      if (!res.ok) {
        setError(res.message);
        setConfirming(false);
      }
    });
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm">
            {displayName ?? "—"}
            {isSelf && <span className="ml-2 text-xs text-zinc-400">(du)</span>}
          </div>
          {status === "invited" && (
            <div className="text-xs text-amber-600 dark:text-amber-400">
              eingeladen – noch nicht angemeldet
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {ROLE_LABEL[role]}
          </span>
          {canRemove &&
            (confirming ? (
              <span className="flex gap-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={remove}
                  className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {pending ? "…" : "Entfernen"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                  className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-700"
                >
                  Abbrechen
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Entfernen
              </button>
            ))}
        </div>
      </div>
      {error && (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
    </Card>
  );
}
