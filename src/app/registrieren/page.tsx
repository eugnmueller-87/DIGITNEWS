import type { Metadata } from "next";

import { PageShell } from "@/components/ui";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Anmelden mit Code" };

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

  return (
    <PageShell
      title="Konto einrichten"
      subtitle="Schritt 1 von 2: E-Mail + Code aus der Einladungs-E-Mail eingeben. Dein Passwort legst du danach selbst fest."
    >
      <RegisterForm presetEmail={email} />
      <p className="mt-6 text-center text-xs text-ink-faint">
        Zugänge werden von deiner Organisation vergeben. Es gibt keine
        Selbstregistrierung.
      </p>
    </PageShell>
  );
}
