"use client";

import { useState, useTransition } from "react";

import { Card, Alert, MiniButton } from "@/components/ui";
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
  photoConsent,
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
  photoConsent: boolean;
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
          <div className="truncate text-sm font-semibold text-ink">
            {displayName ?? "—"}
            {isSelf && <span className="ml-2 text-xs text-ink-soft">(du)</span>}
          </div>
          {status === "invited" && (
            <div className="text-xs font-semibold text-tomato">
              eingeladen – noch nicht angemeldet
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Photo-consent state — so the admin can follow up with members who
              haven't released clear photos. Members only (admins don't consume
              the consent-gated feed the same way). */}
          {role === "member" && (
            <span
              className={
                photoConsent
                  ? "rounded-full bg-sage-soft px-2.5 py-0.5 text-xs font-bold text-ink"
                  : "rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-ink-soft"
              }
              title={
                photoConsent
                  ? "Sieht freigegebene Originalfotos"
                  : "Sieht nur maskierte Fotos"
              }
            >
              {photoConsent ? "Foto: frei" : "Foto: nein"}
            </span>
          )}
          <span className="rounded-full bg-sun-soft px-2.5 py-0.5 text-xs font-bold text-ink">
            {ROLE_LABEL[role]}
          </span>
          {canRemove &&
            (confirming ? (
              <span className="flex gap-1.5">
                <MiniButton
                  tone="danger"
                  disabled={pending}
                  onClick={() => run(() => removePersonAction(id))}
                >
                  {pending ? "…" : "Entfernen"}
                </MiniButton>
                <MiniButton
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                >
                  Abbrechen
                </MiniButton>
              </span>
            ) : (
              <MiniButton onClick={() => setConfirming(true)}>
                Entfernen
              </MiniButton>
            ))}
        </div>
      </div>

      {showManage && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {/* Group assignment */}
          {groups.length > 0 && (
            <label className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
              Gruppe:
              <select
                defaultValue={groupId ?? ""}
                disabled={pending}
                onChange={(e) =>
                  run(() => assignGroupAction(id, e.target.value))
                }
                className="h-11 rounded-[12px] border border-border bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-sun-deep disabled:opacity-50"
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
            <MiniButton
              disabled={pending}
              onClick={() => run(() => setMemberRoleAction(id, true))}
            >
              → Admin
            </MiniButton>
          ) : (
            <MiniButton
              disabled={pending}
              onClick={() => run(() => setMemberRoleAction(id, false))}
            >
              → Mitglied
            </MiniButton>
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
