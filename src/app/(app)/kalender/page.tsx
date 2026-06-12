import type { Metadata } from "next";

import { Card } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
 * month grid + an upcoming list. The "subscribe" link to the ICS feed lives in
 * profile settings. Events come from published posts (the publish step confirms
 * pending events).
 */
export default async function KalenderPage() {
  await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from("events")
    .select(
      "id, title, category, starts_on, ends_on, all_day, time_start, time_end",
    )
    .eq("status", "confirmed")
    .order("starts_on", { ascending: true })
    .limit(500);

  const events = (data ?? []) as CalEvent[];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">Kalender</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Termine und Schließtage deiner Einrichtung.
          </p>
        </div>
      </div>

      {events.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Noch keine Termine.
          </p>
        </Card>
      ) : (
        <CalendarView events={events} />
      )}
    </div>
  );
}
