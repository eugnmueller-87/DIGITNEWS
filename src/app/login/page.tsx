import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell, Alert } from "@/components/ui";
import { brand } from "@/config/brand";
import { getSessionProfile } from "@/lib/auth";

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

  const sp = await searchParams;

  const notice =
    sp.error === "notprovisioned"
      ? "Dein Zugang wurde noch nicht freigeschaltet. Bitte deine Organisation, dich hinzuzufügen."
      : sp.error === "auth"
        ? "Der Link war ungültig oder abgelaufen. Bitte fordere einen neuen an."
        : sp.error === "passwortgesetzt"
          ? null // handled as a success notice below
          : null;

  const success =
    sp.error === "passwortgesetzt"
      ? "Passwort gesetzt. Du kannst dich jetzt anmelden."
      : null;

  return (
    <PageShell
      title={brand.name}
      subtitle="Melde dich mit deiner E-Mail und deinem Passwort an."
    >
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
      <LoginForm />
      <p className="mt-6 text-center text-sm font-semibold text-ink-soft">
        Neu hier?{" "}
        <a href="/registrieren" className="underline">
          Mit Einladungs-Code anmelden
        </a>
      </p>
      <p className="mt-3 text-center text-xs text-zinc-400">
        Zugänge werden von deiner Organisation vergeben. Es gibt keine
        Selbstregistrierung.
      </p>
    </PageShell>
  );
}
