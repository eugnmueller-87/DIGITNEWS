"use client";

import { useState, useTransition } from "react";

import { Card, Alert } from "@/components/ui";
import type { Role, MembershipStatus } from "@/lib/database.types";

import { removePersonAction } from "./actions";
import { setMemberRoleAction, assignGroupAction } from "./member-actions";

const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Operator",
  admin: "Admin",
  member: "Mitglied",
};

export interface GroupOption {
  id: string;
  name: string;
}

/**
 * One member row: name, role badge, invited/active status, group assignment,
 * role promote/demote, and remove. Role + group controls are shown only when the
 * viewer may manage this person (canManage), and never for superadmins/self.
 */
export function MemberRow({
  id,
  role,
  status,
  displayName,
  groupId,
  isSelf,
  canRemove,
  canManage,
  groups,
}: {
  id: string;
  role: Role;
  status: MembershipStatus;
  displayName: string | null;
  groupId: string | null;
  isSelf: boolean;
  canRemove: boolean;
  canManage: boolean;
  groups: GroupOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; message: string | null }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.message);
        setConfirming(false);
      }
    });
  }

  const showManage = canManage && role !== "superadmin" && !isSelf;

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
                  onClick={() => run(() => removePersonAction(id))}
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

      {showManage && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {/* Group assignment */}
          {groups.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-zinc-500">
              Gruppe:
              <select
                defaultValue={groupId ?? ""}
                disabled={pending}
                onChange={(e) =>
                  run(() => assignGroupAction(id, e.target.value))
                }
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">—</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Role promote/demote */}
          {role === "member" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setMemberRoleAction(id, true))}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
            >
              → Admin
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setMemberRoleAction(id, false))}
              className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs disabled:opacity-50 dark:border-zinc-700"
            >
              → Mitglied
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
    </Card>
  );
}
