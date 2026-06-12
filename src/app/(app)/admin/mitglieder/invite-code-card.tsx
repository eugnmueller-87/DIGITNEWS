"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { publicEnv } from "@/lib/env";

/**
 * Shows the org's join link and offers copy / native share. The link is
 * /join/[code] on the canonical site origin. Sharing the code is how members
 * are onboarded (Brief §5).
 */
export function InviteCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${publicEnv.siteUrl}/join/${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable; the input is selectable as fallback */
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ url, title: "Beitritts-Link" });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  }

  return (
    <Card>
      <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Beitritts-Link
      </h2>
      <p className="mt-1 text-xs text-zinc-400">
        Teile diesen Link mit deinen Mitgliedern.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          readOnly
          value={url}
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
        <button
          type="button"
          onClick={share}
          className="shrink-0 rounded-lg bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Teilen
        </button>
      </div>
    </Card>
  );
}
