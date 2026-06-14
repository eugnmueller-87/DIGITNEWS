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
          <h2 className="font-display text-base font-bold text-ink">
            E-Mail-Benachrichtigungen
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
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
            on ? "bg-accent" : "bg-border"
          } disabled:opacity-50`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              on ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </Card>
  );
}
