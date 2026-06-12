"use client";

import { useState, useTransition } from "react";
import { approveJoinRequest, rejectJoinRequest } from "./actions";
import { Card, Alert } from "@/components/ui";

/**
 * One pending join request with Approve / Reject controls. Uses transitions so
 * the row reflects pending state; the server actions revalidate the page on
 * success, removing the row.
 */
export function JoinRequestRow({ id, email }: { id: string; email: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(fn: (id: string) => Promise<{ ok: boolean; message: string | null }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn(id);
      if (!res.ok) setError(res.message);
    });
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm">{email}</span>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => act(rejectJoinRequest)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Ablehnen
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => act(approveJoinRequest)}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Freigeben
          </button>
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
