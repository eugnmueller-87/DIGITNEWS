import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { PageShell } from "@/components/ui";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Anmelden" };

export default function LoginPage() {
  return (
    <PageShell
      title={brand.name}
      subtitle="Melde dich mit deiner E-Mail an — wir schicken dir einen Login-Link."
    >
      <LoginForm />
      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Noch keine Organisation?{" "}
        <Link href="/start" className="font-medium underline underline-offset-4">
          Jetzt eine anlegen
        </Link>
      </p>
    </PageShell>
  );
}
