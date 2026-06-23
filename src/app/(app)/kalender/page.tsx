import type { Metadata } from "next";

import { MarkSeen } from "@/app/(app)/bereiche/mark-seen";
import { EmptyState } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { fetchEventTitleTranslations } from "@/lib/content/localize";
import { publicEnv } from "@/lib/env";
import { getDict, getLocale } from "@/lib/i18n/server";
import { getActiveIcsToken } from "@/lib/ics";
import { createClient } from "@/lib/supabase/server";

import { CalendarSubBanner } from "./calendar-sub-banner";
import { CalendarView } from "./calendar-view";
import { ManualEventPanel, type ManualEvent } from "./manual-event-panel";

export const metadata: Metadata = { title: "Kalender" };

export interface CalEvent {
  id: string;
  title: string;
  category: "closure" | "event" | "deadline";
  starts_on: string;
  ends_on: string | null;
  all_day: boolean;
  time_start: string | null;
  time_end: string | null;
}

/**
 * Member calendar. Lists this org's CONFIRMED events (RLS-scoped) and renders a
 * month grid + an upcoming list. A pinned banner makes the personal-calendar
 * subscription (ICS) a first-class action so Aushang events flow into the
 * parent's Google/Apple calendar. The ICS token lookup runs in parallel with
 * the events fetch and degrades gracefully if absent.
 */
export default async function KalenderPage() {
  const session = await requireSession();
  const t = await getDict();
  const supabase = await createClient();
  const isSuperadmin = session.role === "superadmin";

  const [eventsResult, token] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, title, category, starts_on, ends_on, all_day, time_start, time_end",
      )
      .eq("status", "confirmed")
      .order("starts_on", { ascending: true })
      .limit(500),
    getActiveIcsToken(session.userId),
  ]);

  // Superadmin-only: the cross-org list of orgs (for the target picker) and the
  // operator's manually-created events (for edit/delete). Read cross-org via the
  // service-role admin client because the operator's own RLS scopes to their
  // anchor org — these reads are gated by the isSuperadmin check above.
  let orgOptions: { id: string; name: string }[] = [];
  let manualEvents: ManualEvent[] = [];
  if (isSuperadmin) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const [{ data: orgs }, { data: mevents }] = await Promise.all([
      admin.from("orgs").select("id, name").order("name", { ascending: true }),
      // Manual events are those whose carrier post is an archived 'event_notice'.
      admin
        .from("events")
        .select(
          "id, org_id, title, category, starts_on, ends_on, all_day, time_start, time_end, posts!inner(status, content_type)",
        )
        .eq("status", "confirmed")
        .eq("posts.status", "archived")
        .eq("posts.content_type", "event_notice")
        .order("starts_on", { ascending: true })
        .limit(200),
    ]);
    orgOptions = (orgs ?? []) as { id: string; name: string }[];
    manualEvents = ((mevents ?? []) as unknown as ManualEvent[]).map((e) => ({
      id: e.id,
      org_id: e.org_id,
      title: e.title,
      category: e.category,
      starts_on: e.starts_on,
      ends_on: e.ends_on,
      all_day: e.all_day,
      time_start: e.time_start,
      time_end: e.time_end,
    }));
  }

  const rawEvents = (eventsResult.data ?? []) as CalEvent[];
  // Overlay AI-translated event titles for the active locale (German falls
  // through). One query; untranslated events keep their German title.
  const eventTitles = await fetchEventTitleTranslations(
    rawEvents.map((e) => e.id),
    await getLocale(),
  );
  const events = rawEvents.map((e) => ({
    ...e,
    title: eventTitles.get(e.id) ?? e.title,
  }));
  const icsUrl = token ? `${publicEnv.siteUrl}/api/ics/${token}` : null;

  return (
    <div className="space-y-4">
      <MarkSeen category="event_notice" />
      <h1 className="font-display text-[26px] font-bold leading-tight text-ink">
        {t.calendar.title}
      </h1>

      <CalendarSubBanner icsUrl={icsUrl} hasSub={token != null} />

      {isSuperadmin && (
        <ManualEventPanel orgs={orgOptions} events={manualEvents} />
      )}

      {events.length === 0 ? (
        <EmptyState title={t.calendar.emptyTitle} hint={t.calendar.emptyHint} />
      ) : (
        <CalendarView events={events} />
      )}
    </div>
  );
}
