import type { Metadata } from "next";
import Link from "next/link";
import { StartForm } from "./start-form";
import { PageShell, Alert } from "@/components/ui";
import { brand } from "@/config/brand";
import { serverEnv } from "@/lib/env.server";

export const metadata: Metadata = { title: "Organisation anlegen" };

export default function StartPage() {
  return (
    <PageShell
      title="Organisation anlegen"
      subtitle={brand.tagline}
    >
      {serverEnv.allowOrgSignup ? (
        <StartForm />
      ) : (
        <Alert variant="info">
          Die Registrierung läuft gerade über eine Warteliste. Melde dich bei
          uns, dann schalten wir deine Organisation frei.
        </Alert>
      )}
      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Schon dabei?{" "}
        <Link href="/login" className="font-medium underline underline-offset-4">
          Anmelden
        </Link>
      </p>
    </PageShell>
  );
}
