import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageShell, Alert } from "@/components/ui";
import { brand } from "@/config/brand";
import { previewJoinCode } from "@/lib/applications";
import { parseJoinCode } from "@/lib/validation";

import { ApplyForm } from "./apply-form";

export const metadata: Metadata = { title: "Zugang beantragen" };

/**
 * Public QR self-apply page. A parent scans the org's QR and lands here. We
 * preview the code server-side (service role; no anon RLS) to confirm it's live
 * and show the org name, then render the application form. Submitting sends an
 * email verification link; after verifying, the request awaits admin approval.
 */
export default async function ApplyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;

  let code: string;
  try {
    code = parseJoinCode(rawCode);
  } catch {
    notFound();
  }

  const preview = await previewJoinCode(code);

  return (
    <PageShell
      title={preview.valid && preview.orgName ? preview.orgName : "Zugang"}
      subtitle={
        preview.valid ? `Zugang zu ${brand.name} beantragen.` : undefined
      }
    >
      {preview.valid ? (
        <ApplyForm code={code} />
      ) : (
        <Alert variant="error">
          Dieser Zugangs-Code ist ungültig oder nicht mehr aktiv. Bitte wende
          dich an deine Einrichtung.
        </Alert>
      )}
    </PageShell>
  );
}
