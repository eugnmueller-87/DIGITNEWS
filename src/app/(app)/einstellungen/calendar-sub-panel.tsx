"use client";

import { useState, useTransition } from "react";

import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui";

import { enableCalendarSub, disableCalendarSub } from "./actions";

/**
 * Calendar subscription — a first-class feature. When active, offers one-tap
 * platform shortcuts derived ENTIRELY client-side from the already-minted
 * `icsUrl` (no backend, no new token/PII/auth):
 *   • Apple  — webcal:// scheme swap → iOS opens the native Add-Subscription dialog
 *   • Google — calendar/render?cid=<webcal url>
 *   • Andere — clipboard copy
 * The platform we detect (iOS/Android) is elevated as the primary action.
 * Inactive → one button to mint the token. The token is unguessable + revocable
 * (revoking rotates it). Reused by the /kalender hero sheet AND Einstellungen.
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

  if (!icsUrl) {
    return (
      <div className="space-y-3">
        <p className="text-[15px] text-ink-soft">
          Alle bestätigten Termine deiner Einrichtung landen automatisch in
          deinem Kalender — jederzeit widerrufbar.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(enableCalendarSub)}
          className="press flex h-12 w-full items-center justify-center rounded-full bg-accent font-bold text-white disabled:opacity-50"
        >
          {pending ? "…" : "Kalender-Abo aktivieren"}
        </button>
        {error && <Alert variant="error">{error}</Alert>}
      </div>
    );
  }

  // Client URL transforms of the public token — no backend involved.
  const webcal = icsUrl.replace(/^https?:\/\//, "webcal://");
  const google = `https://www.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isApple = /iPhone|iPad|iPod|Macintosh/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  function copy() {
    void navigator.clipboard
      .writeText(icsUrl as string)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {});
  }

  const apple = (
    <a
      key="apple"
      href={webcal}
      className="press flex h-12 items-center justify-center gap-2 rounded-full bg-accent font-bold text-white"
    >
      <Icon name="calendarPlus" size={18} /> Apple Kalender
    </a>
  );
  const goog = (
    <a
      key="google"
      href={google}
      target="_blank"
      rel="noopener noreferrer"
      className="press flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-paper font-bold text-ink"
    >
      <Icon name="calendarPlus" size={18} className="text-ink-soft" /> Google
      Kalender
    </a>
  );
  // Elevate the platform default first.
  const platformRows = isAndroid
    ? [goog, apple]
    : isApple
      ? [apple, goog]
      : [apple, goog];

  return (
    <div className="space-y-2.5">
      {platformRows}
      <button
        type="button"
        onClick={copy}
        className="press flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-paper font-bold text-ink"
      >
        {copied ? "Kopiert ✓" : "Andere App (URL kopieren)"}
      </button>
      <div className="rounded-[12px] bg-surface-2 px-3 py-2">
        <p className="truncate text-xs text-ink-faint" title={icsUrl}>
          {icsUrl}
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(disableCalendarSub)}
        className="mx-auto block text-xs font-semibold text-ink-soft underline disabled:opacity-50"
      >
        Abo widerrufen
      </button>
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}
