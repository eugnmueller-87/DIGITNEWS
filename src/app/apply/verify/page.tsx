import type { Metadata } from "next";

import { PageShell, Alert } from "@/components/ui";
import { verifyApplication } from "@/lib/applications";
import { getDict } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDict();
  return { title: t.verify.title };
}

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
  const t = await getDict();

  return (
    <PageShell title={t.verify.title}>
      {ok ? (
        <Alert variant="success">{t.verify.success}</Alert>
      ) : (
        <Alert variant="error">{t.verify.invalid}</Alert>
      )}
    </PageShell>
  );
}
