import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageShell, Alert } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Passwort festlegen" };

/**
 * Set-password landing. Reached after the user verified their registration code
 * on /registrieren (verifyOtp established a session). We require a valid auth
 * user (the code-issued session) — NOT a full profile — because an invited user
 * sets their password here before their first real login.
 *
 * If there's no session, the code wasn't verified: bounce to /registrieren.
 */
export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/registrieren");

  return (
    <PageShell
      title="Passwort festlegen"
      subtitle="Wähle ein Passwort für deinen Zugang. Danach meldest du dich damit an."
    >
      <SetPasswordForm />
      <div className="mt-4">
        <Alert variant="info">
          Mindestens 8 Zeichen. Bewahre dein Passwort sicher auf.
        </Alert>
      </div>
    </PageShell>
  );
}
