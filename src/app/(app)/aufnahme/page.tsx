import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";

import { CapturePanel } from "./capture-panel";

export const metadata: Metadata = { title: "Aushang fotografieren" };

/**
 * Admin capture page. Photographs a notice (rear camera on mobile), compresses
 * it client-side, uploads the raw image to the private bucket, and triggers the
 * worker. The worker OCRs, redacts PII, and produces a draft for review.
 */
export default async function AufnahmePage() {
  const session = await requireAdmin();
  const t = await getDict();
  // Only the operator can override the exact-photo dedup ("upload anyway").
  const isSuperadmin = session.role === "superadmin";
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-display text-[26px] font-bold leading-tight text-ink">
          {t.aufnahme.title}
        </h1>
        <p className="mx-auto mt-1 max-w-sm text-[15px] text-ink-soft">
          {t.aufnahme.subtitle}
        </p>
      </div>
      <CapturePanel isSuperadmin={isSuperadmin} />
    </div>
  );
}
