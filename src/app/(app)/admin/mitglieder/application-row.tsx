"use client";

import { useState, useTransition } from "react";

import { Card, Alert, MiniButton } from "@/components/ui";
import { fmt } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/provider";

import {
  approveApplicationAction,
  rejectApplicationAction,
} from "./qr-actions";

/**
 * One QR application in the approval queue. Verified requests get Approve/Reject
 * controls; un-verified ("awaiting email") ones are shown read-only so the admin
 * knows someone applied but hasn't confirmed their email yet.
 *
 * PRIVACY: the parent/child/group fields shown here are purged from the DB the
 * moment the admin approves or rejects (migration 0009).
 */
export function ApplicationRow({
  id,
  email,
  parentName,
  childName,
  group,
  awaitingEmail,
}: {
  id: string;
  email: string;
  parentName: string | null;
  childName: string | null;
  group: string | null;
  awaitingEmail: boolean;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(
    fn: (id: string) => Promise<{ ok: boolean; message: string | null }>,
  ) {
    setError(null);
    startTransition(async () => {
      const res = await fn(id);
      if (!res.ok) setError(res.message);
    });
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">
            {parentName ?? email}
          </div>
          <div className="mt-0.5 space-y-0.5 text-xs font-semibold text-ink-soft">
            {childName && (
              <div>
                {fmt(t.members.child, { name: childName })}
                {group ? ` · ${group}` : ""}
              </div>
            )}
            <div className="truncate">{email}</div>
          </div>
          {awaitingEmail && (
            <div className="mt-1 text-xs font-semibold text-tomato">
              {t.members.awaitingEmail}
            </div>
          )}
        </div>

        {!awaitingEmail && (
          <div className="flex shrink-0 gap-2">
            <MiniButton
              disabled={pending}
              onClick={() => act(rejectApplicationAction)}
            >
              {t.members.reject}
            </MiniButton>
            <MiniButton
              tone="primary"
              disabled={pending}
              onClick={() => act(approveApplicationAction)}
            >
              {t.members.approve}
            </MiniButton>
          </div>
        )}
      </div>
      {error && (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
    </Card>
  );
}
