import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth";

import { CapturePanel } from "./capture-panel";

export const metadata: Metadata = { title: "Aushang fotografieren" };

/**
 * Admin capture page. Photographs a notice (rear camera on mobile), compresses
 * it client-side, uploads the raw image to the private bucket, and triggers the
 * worker. The worker OCRs, redacts PII, and produces a draft for review.
 */
export default async function AufnahmePage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Aushang fotografieren</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Fotografiere den Aushang. Wir lesen ihn aus, maskieren persönliche
          Daten und legen dir einen Entwurf zum Prüfen an.
        </p>
      </div>
      <CapturePanel />
    </div>
  );
}
