"use client";

import { useState, useTransition } from "react";

import { Alert, MiniButton } from "@/components/ui";
import type { Role, MembershipStatus } from "@/lib/database.types";

import { setAdminAction } from "./actions";

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
    return <p className="mt-2 text-sm text-ink-soft">Noch keine Personen.</p>;
  }

  return (
    <div className="mt-3 space-y-1.5">
      {people.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between gap-2 text-sm"
        >
          <span className="min-w-0 truncate text-ink">
            {p.displayName ?? "—"}
            {p.status === "invited" && (
              <span className="ml-2 text-xs text-sun-deep">eingeladen</span>
            )}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-soft">
              {p.role === "superadmin"
                ? "Operator"
                : p.role === "admin"
                  ? "Admin"
                  : "Mitglied"}
            </span>
            {p.role === "member" && (
              <MiniButton
                type="button"
                disabled={pending}
                onClick={() => toggle(p.id, true)}
              >
                → Admin
              </MiniButton>
            )}
            {p.role === "admin" && (
              <MiniButton
                type="button"
                disabled={pending}
                onClick={() => toggle(p.id, false)}
              >
                → Mitglied
              </MiniButton>
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
