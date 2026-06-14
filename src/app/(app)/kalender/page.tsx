import type { Metadata } from "next";

import { EmptyState } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { getActiveIcsToken } from "@/lib/ics";
import { createClient } from "@/lib/supabase/server";

import { CalendarSubBanner } from "./calendar-sub-banner";
import { CalendarView } from "./calendar-view";

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
  const supabase = await createClient();

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

  const events = (eventsResult.data ?? []) as CalEvent[];
  const icsUrl = token ? `${publicEnv.siteUrl}/api/ics/${token}` : null;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-[26px] font-bold leading-tight text-ink">
        Kalender
      </h1>

      <CalendarSubBanner icsUrl={icsUrl} hasSub={token != null} />

      {events.length === 0 ? (
        <EmptyState
          title="Noch keine Termine."
          hint="Sobald deine Einrichtung Termine veröffentlicht, erscheinen sie hier — und in deinem abonnierten Kalender."
        />
      ) : (
        <CalendarView events={events} />
      )}
    </div>
  );
}
