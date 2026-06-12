"use client";

import { useState, useTransition } from "react";

import { Card, Alert } from "@/components/ui";

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
          <div className="truncate text-sm font-medium">
            {parentName ?? email}
          </div>
          <div className="mt-0.5 space-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {childName && (
              <div>
                Kind: {childName}
                {group ? ` · ${group}` : ""}
              </div>
            )}
            <div className="truncate">{email}</div>
          </div>
          {awaitingEmail && (
            <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              wartet auf E-Mail-Bestätigung
            </div>
          )}
        </div>

        {!awaitingEmail && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => act(rejectApplicationAction)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Ablehnen
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => act(approveApplicationAction)}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Freigeben
            </button>
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
