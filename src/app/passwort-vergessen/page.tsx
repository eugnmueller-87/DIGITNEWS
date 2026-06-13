import type { Metadata } from "next";

import { PageShell } from "@/components/ui";

import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Passwort vergessen" };

export default function ForgotPasswordPage() {
  return (
    <PageShell
      title="Passwort vergessen"
      subtitle="Gib deine E-Mail ein — wir schicken dir einen Link, um ein neues Passwort festzulegen."
    >
      <ForgotForm />
    </PageShell>
  );
}
