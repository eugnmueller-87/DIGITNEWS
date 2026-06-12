import type { Metadata } from "next";

import { PageShell, Alert } from "@/components/ui";
import { verifyApplication } from "@/lib/applications";

export const metadata: Metadata = { title: "Bestätigung" };

/**
 * Email verification landing for a QR application. The link carries ?id & ?token
 * (the plaintext token; only its hash is stored). We verify server-side: on
 * success the application moves to 'verified, awaiting approval'. Single-use and
 * expiring. Result is rendered with a neutral message — no detail leak.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; token?: string }>;
}) {
  const sp = await searchParams;
  const id = (sp.id ?? "").trim();
  const token = (sp.token ?? "").trim();

  // Validate the id is a uuid shape before hitting the DB.
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const ok = isUuid && token.length > 0 && (await verifyApplication(id, token));

  return (
    <PageShell title="Bestätigung">
      {ok ? (
        <Alert variant="success">
          Danke! Deine E-Mail ist bestätigt. Die Einrichtung prüft deine Anfrage
          und schaltet dich frei. Du bekommst dann eine E-Mail mit deinem
          Login-Link.
        </Alert>
      ) : (
        <Alert variant="error">
          Dieser Bestätigungs-Link ist ungültig oder abgelaufen. Bitte beantrage
          den Zugang erneut.
        </Alert>
      )}
    </PageShell>
  );
}
