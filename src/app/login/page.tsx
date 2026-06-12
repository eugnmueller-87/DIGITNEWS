import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { PageShell, Alert } from "@/components/ui";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  const notice =
    sp.error === "notprovisioned"
      ? "Dein Zugang wurde noch nicht freigeschaltet. Bitte deine Organisation, dich hinzuzufügen."
      : sp.error === "auth"
        ? "Der Login-Link war ungültig oder abgelaufen. Fordere einen neuen an."
        : null;

  return (
    <PageShell
      title={brand.name}
      subtitle="Melde dich mit deiner E-Mail an — wir schicken dir einen Login-Link."
    >
      {notice && (
        <div className="mb-4">
          <Alert variant="error">{notice}</Alert>
        </div>
      )}
      <LoginForm />
      <p className="mt-6 text-center text-xs text-zinc-400">
        Zugänge werden von deiner Organisation vergeben. Es gibt keine
        Selbstregistrierung.
      </p>
    </PageShell>
  );
}
