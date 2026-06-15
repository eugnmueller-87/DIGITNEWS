import type { Metadata } from "next";

import { PageShell } from "@/components/ui";
import { getDict } from "@/lib/i18n/server";

import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Passwort vergessen" };

export default async function ForgotPasswordPage() {
  const t = await getDict();

  return (
    <PageShell title={t.auth.forgotTitle} subtitle={t.auth.forgotSubtitle}>
      <ForgotForm dict={t.auth} />
    </PageShell>
  );
}
