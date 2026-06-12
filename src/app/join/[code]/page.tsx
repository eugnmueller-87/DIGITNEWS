import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JoinForm } from "./join-form";
import { PageShell, Alert } from "@/components/ui";
import { brand } from "@/config/brand";
import { previewInvite } from "@/lib/invites";
import { parseInviteCode } from "@/lib/validation";

export const metadata: Metadata = { title: "Beitreten" };

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;

  let code: string;
  try {
    code = parseInviteCode(rawCode);
  } catch {
    notFound();
  }

  const preview = await previewInvite(code);

  return (
    <PageShell
      title={
        preview.valid && preview.orgName
          ? preview.orgName
          : "Einladung"
      }
      subtitle={
        preview.valid
          ? `Tritt der Organisation auf ${brand.name} bei.`
          : undefined
      }
    >
      {preview.valid ? (
        <JoinForm code={code} requiresApproval={preview.requiresApproval} />
      ) : (
        // Single generic message for ALL invalid states (not-found / expired /
        // exhausted). Distinguishing them was an enumeration oracle that let an
        // attacker fingerprint invite state. The 48-bit code makes brute force
        // infeasible regardless; this removes the remaining state leak.
        <Alert variant="error">
          Dieser Einladungslink ist ungültig oder nicht mehr aktiv. Bitte frag
          deine Organisation nach einem aktuellen Link.
        </Alert>
      )}
    </PageShell>
  );
}
