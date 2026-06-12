"use client";

import { useState, useTransition } from "react";

import { Card, Button, Alert } from "@/components/ui";

import { enableCalendarSub, disableCalendarSub } from "./actions";

/**
 * Calendar subscription panel. Shows the ICS feed URL when active (copy to add
 * it to a phone/computer calendar), or a button to enable it. The token is
 * unguessable + revocable; revoking rotates it.
 */
export function CalendarSubPanel({ icsUrl }: { icsUrl: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; message: string | null }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.message);
    });
  }

  function copy() {
    if (!icsUrl) return;
    void navigator.clipboard
      .writeText(icsUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {});
  }

  return (
    <Card>
      <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Kalender abonnieren
      </h2>
      <p className="mt-1 text-xs text-zinc-400">
        Abonniere die Termine in deiner Kalender-App (Handy oder Computer) und
        erhalte automatisch Updates.
      </p>

      {icsUrl ? (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              readOnly
              value={icsUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
            />
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-lg border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {copied ? "Kopiert ✓" : "Kopieren"}
            </button>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(disableCalendarSub)}
            className="text-xs text-zinc-500 underline disabled:opacity-50"
          >
            Abo widerrufen
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <Button onClick={() => run(enableCalendarSub)} disabled={pending}>
            {pending ? "…" : "Kalender-Abo aktivieren"}
          </Button>
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
