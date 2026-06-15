import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell, Alert } from "@/components/ui";
import { brand } from "@/config/brand";
import { getSessionProfile } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // If already signed in WITH a profile, skip the login form entirely.
  const session = await getSessionProfile();
  if (session) redirect("/feed");

  const t = await getDict();
  const sp = await searchParams;

  const notice =
    sp.error === "notprovisioned"
      ? t.auth.notProvisioned
      : sp.error === "auth"
        ? t.auth.linkInvalid
        : sp.error === "passwortgesetzt"
          ? null // handled as a success notice below
          : null;

  const success = sp.error === "passwortgesetzt" ? t.auth.passwordSet : null;

  return (
    <PageShell title={brand.name} subtitle={t.auth.loginSubtitle}>
      {notice && (
        <div className="mb-4">
          <Alert variant="error">{notice}</Alert>
        </div>
      )}
      {success && (
        <div className="mb-4">
          <Alert variant="success">{success}</Alert>
        </div>
      )}
      <LoginForm dict={t.auth} />
      <p className="mt-6 text-center text-sm font-semibold text-ink-soft">
        {t.auth.newHere}{" "}
        <a href="/registrieren" className="underline">
          {t.auth.withCode}
        </a>
      </p>
      <p className="mt-3 text-center text-xs text-zinc-400">
        {t.auth.noSelfSignup}
      </p>
    </PageShell>
  );
}
