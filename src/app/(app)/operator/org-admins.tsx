"use client";

import { useState, useTransition } from "react";
import { setAdminAction } from "./actions";
import { Alert } from "@/components/ui";
import type { Role, MembershipStatus } from "@/lib/database.types";

interface Person {
  id: string;
  role: Role;
  status: MembershipStatus;
  displayName: string | null;
}

/**
 * Per-org people list with grant/revoke-admin toggles (superadmin only).
 * Superadmins themselves are shown but not toggleable. Members can be promoted;
 * admins can be demoted (subject to the last-admin guard in the DB).
 */
export function OrgAdmins({ people }: { people: Person[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string, makeAdmin: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await setAdminAction(id, makeAdmin);
      if (!res.ok) setError(res.message);
    });
  }

  if (people.length === 0) {
    return (
      <p className="mt-2 text-xs text-zinc-400">Noch keine Personen.</p>
    );
  }

  return (
    <div className="mt-3 space-y-1.5">
      {people.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between gap-2 text-sm"
        >
          <span className="min-w-0 truncate">
            {p.displayName ?? "—"}
            {p.status === "invited" && (
              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                eingeladen
              </span>
            )}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {p.role === "superadmin"
                ? "Operator"
                : p.role === "admin"
                  ? "Admin"
                  : "Mitglied"}
            </span>
            {p.role === "member" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => toggle(p.id, true)}
                className="rounded-lg border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                → Admin
              </button>
            )}
            {p.role === "admin" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => toggle(p.id, false)}
                className="rounded-lg border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                → Mitglied
              </button>
            )}
          </div>
        </div>
      ))}
      {error && (
        <div className="pt-1">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
    </div>
  );
}
