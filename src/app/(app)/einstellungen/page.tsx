import type { Metadata } from "next";

import { Card } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { getDict } from "@/lib/i18n/server";
import { getActiveIcsToken } from "@/lib/ics";
import { createClient } from "@/lib/supabase/server";

import { CalendarSubPanel } from "./calendar-sub-panel";
import { DeleteAccountPanel } from "./delete-account-panel";
import { DigestToggle } from "./digest-toggle";
import { LanguageSelect } from "./language-select";
import { PhotoConsentToggle } from "./photo-consent-toggle";
import { PushPanel } from "./push-panel";

export const metadata: Metadata = { title: "Einstellungen" };

/**
 * Member settings: calendar subscription (ICS), email-digest opt-in, and account
 * deletion. All reads/writes are the caller's own (RLS-governed / definer flows).
 */
export default async function EinstellungenPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const t = await getDict();

  const [{ data: profile }, token] = await Promise.all([
    supabase
      .from("profiles")
      .select("email_digest_opt_in, photo_consent")
      .eq("id", session.userId)
      .maybeSingle(),
    getActiveIcsToken(session.userId),
  ]);

  const icsUrl = token ? `${publicEnv.siteUrl}/api/ics/${token}` : null;
  const isLastAdminRisk = session.role === "admin";

  return (
    <div className="space-y-6">
      <h1 className="font-display text-[26px] font-bold leading-tight text-ink">
        {t.settings.title}
      </h1>

      <Card>
        <h2 className="font-display mb-1 text-base font-bold text-ink">
          {t.settings.calendarSubHeading}
        </h2>
        <p className="mb-3 text-sm text-ink-soft">
          {t.settings.calendarSubDesc}
        </p>
        <CalendarSubPanel icsUrl={icsUrl} />
      </Card>
      <PushPanel vapidPublicKey={publicEnv.vapidPublicKey} />
      <DigestToggle initial={profile?.email_digest_opt_in ?? true} />
      <PhotoConsentToggle initial={profile?.photo_consent ?? false} />
      <LanguageSelect />
      <DeleteAccountPanel role={session.role} warnLastAdmin={isLastAdminRisk} />
    </div>
  );
}
