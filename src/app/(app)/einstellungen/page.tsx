import type { Metadata } from "next";

import { requireSession } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { getActiveIcsToken } from "@/lib/ics";
import { createClient } from "@/lib/supabase/server";

import { CalendarSubPanel } from "./calendar-sub-panel";
import { DeleteAccountPanel } from "./delete-account-panel";
import { DigestToggle } from "./digest-toggle";
import { PushPanel } from "./push-panel";

export const metadata: Metadata = { title: "Einstellungen" };

/**
 * Member settings: calendar subscription (ICS), email-digest opt-in, and account
 * deletion. All reads/writes are the caller's own (RLS-governed / definer flows).
 */
export default async function EinstellungenPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [{ data: profile }, token] = await Promise.all([
    supabase
      .from("profiles")
      .select("email_digest_opt_in")
      .eq("id", session.userId)
      .maybeSingle(),
    getActiveIcsToken(session.userId),
  ]);

  const icsUrl = token ? `${publicEnv.siteUrl}/api/ics/${token}` : null;
  const isLastAdminRisk = session.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Einstellungen</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Kalender abonnieren, Benachrichtigungen, Konto.
        </p>
      </div>

      <CalendarSubPanel icsUrl={icsUrl} />
      <PushPanel vapidPublicKey={publicEnv.vapidPublicKey} />
      <DigestToggle initial={profile?.email_digest_opt_in ?? true} />
      <DeleteAccountPanel role={session.role} warnLastAdmin={isLastAdminRisk} />
    </div>
  );
}
