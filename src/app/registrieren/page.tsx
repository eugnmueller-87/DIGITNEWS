import type { Metadata } from "next";

import { PageShell } from "@/components/ui";
import { getDict } from "@/lib/i18n/server";

import { RegisterForm } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDict();
  return { title: t.auth.registerMetaTitle };
}

/**
 * Registration / first-login landing. The user enters their email + the 6-digit
 * code from the invite email (typed, not a clickable link — immune to email
 * scanners). On success they go to /set-password. `?email=` pre-fills from a
 * convenience link if present.
 */
export default async function RegistrierenPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const t = await getDict();

  return (
    <PageShell title={t.auth.registerTitle} subtitle={t.auth.registerSubtitle}>
      <RegisterForm presetEmail={email} dict={t.auth} />
      <p className="mt-6 text-center text-xs text-ink-faint">
        {t.auth.noSelfSignup}
      </p>
    </PageShell>
  );
}
