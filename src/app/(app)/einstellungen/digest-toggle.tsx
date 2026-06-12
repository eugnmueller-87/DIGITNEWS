"use client";

import { useState, useTransition } from "react";

import { Card } from "@/components/ui";

import { setDigestOptIn } from "./actions";

/** Email-digest opt-in toggle for the caller's own profile. */
export function DigestToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    start(async () => {
      const res = await setDigestOptIn(next);
      if (!res.ok) setOn(!next); // revert on failure
    });
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            E-Mail-Benachrichtigungen
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Erhalte eine E-Mail, wenn deine Einrichtung etwas veröffentlicht.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={pending}
          onClick={toggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            on ? "bg-zinc-900 dark:bg-white" : "bg-zinc-300 dark:bg-zinc-700"
          } disabled:opacity-50`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform dark:bg-zinc-900 ${
              on ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </Card>
  );
}
