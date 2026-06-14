"use client";

import { useState } from "react";

import { CalendarSubPanel } from "@/app/(app)/einstellungen/calendar-sub-panel";
import { BottomSheet } from "@/components/bottom-sheet";
import { Icon } from "@/components/icons";

/**
 * The first-class "subscribe to the calendar" surface on /kalender: a pinned
 * teal-soft banner that opens a bottom sheet with the one-tap Apple/Google
 * shortcuts. `hasSub` reflects whether the user already has an active ICS token
 * (resolved server-side) so the banner can show an "Abo aktiv" state.
 */
export function CalendarSubBanner({
  icsUrl,
  hasSub,
}: {
  icsUrl: string | null;
  hasSub: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press flex w-full items-center gap-3 rounded-[16px] bg-accent-soft p-4 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white">
          <Icon name="calendarPlus" size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-ink">
            {hasSub ? "Kalender-Abo aktiv" : "Alle Termine in deinem Kalender"}
          </span>
          <span className="block text-sm text-ink-soft">
            {hasSub
              ? "Tippen, um die Verknüpfung erneut zu öffnen"
              : "Einmal abonnieren — neue Termine kommen automatisch"}
          </span>
        </span>
        {hasSub && (
          <Icon name="check" size={20} className="shrink-0 text-sage" />
        )}
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Kalender abonnieren"
      >
        <CalendarSubPanel icsUrl={icsUrl} />
      </BottomSheet>
    </>
  );
}
