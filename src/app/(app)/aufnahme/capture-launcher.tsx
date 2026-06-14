"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { BottomSheet } from "@/components/bottom-sheet";
import { Icon } from "@/components/icons";
import { SunLogo } from "@/components/sun-logo";
import { Alert } from "@/components/ui";

import { useCapture } from "./use-capture";

/**
 * The staff capture entry point on a phone: a raised teal FAB that opens a
 * bottom sheet offering the two sources (camera / gallery), then shows live
 * per-shot progress. Mounted once in the (app) layout for admins. The camera
 * input keeps capture="environment"; the gallery input has none — one shared
 * handler (useCapture). The privacy/upload path is unchanged.
 */
export function CaptureLauncher() {
  const [open, setOpen] = useState(false);
  // The /aufnahme page IS the full capture entry point — showing the floating
  // FAB there too would be a redundant second camera button. Hide it there.
  const pathname = usePathname();
  const {
    cameraInputRef,
    galleryInputRef,
    openCamera,
    openGallery,
    status,
    error,
    notice,
    shots,
    handleFiles,
    working,
  } = useCapture();

  const anyQueued = shots.some(
    (s) => s.state === "queued" || s.state === "processing",
  );

  // All hooks have run above; safe to bail out of rendering the FAB here.
  if (pathname === "/aufnahme") return null;

  return (
    // Phone-only: on desktop, capture is the nav tab (/aufnahme). Gating the
    // whole launcher prevents the FAB + sheet from overlaying desktop content.
    <div className="sm:hidden">
      {/* Hidden inputs (shared handler) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {/* FAB — sits just above the bottom bar, phone only */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Aushang aufnehmen"
        className="press fixed bottom-[5.5rem] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-float sm:hidden"
      >
        <Icon name="capture" size={26} />
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Aushang aufnehmen"
      >
        {/* Two large source rows */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => openCamera()}
            disabled={working}
            className="press flex h-16 w-full items-center gap-3 rounded-[14px] bg-accent px-5 text-left text-white disabled:opacity-60"
          >
            <Icon name="capture" size={24} />
            <span>
              <span className="block font-bold">Foto aufnehmen</span>
              <span className="block text-sm opacity-90">Kamera öffnen</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => openGallery()}
            disabled={working}
            className="press flex h-16 w-full items-center gap-3 rounded-[14px] border border-border bg-surface-2 px-5 text-left text-ink disabled:opacity-60"
          >
            <Icon name="image" size={24} className="text-ink-soft" />
            <span>
              <span className="block font-bold">Aus Galerie wählen</span>
              <span className="block text-sm text-ink-soft">
                Galerie oder Dateien
              </span>
            </span>
          </button>
        </div>

        <p className="mt-3 text-center text-sm text-ink-soft">
          Auch schräg oder unscharf ist okay.
        </p>

        {shots.length > 0 && (
          <ul className="mt-4 space-y-2">
            {shots.map((shot, i) => (
              <li
                key={shot.id}
                className="flex items-center justify-between rounded-[12px] bg-surface-2 px-3 py-2 text-sm"
              >
                <span className="font-semibold text-ink">Foto {i + 1}</span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                  {(shot.state === "uploading" ||
                    shot.state === "processing") && (
                    <>
                      <SunLogo className="h-4 w-4" spinning />
                      {shot.state === "uploading"
                        ? "lädt hoch …"
                        : "wird ausgelesen …"}
                    </>
                  )}
                  {shot.state === "queued" && (
                    <span className="flex items-center gap-1 text-sage">
                      <Icon name="check" size={14} /> in Bearbeitung
                    </span>
                  )}
                  {shot.state === "duplicate" && "bereits aufgenommen"}
                  {shot.state === "failed" && (
                    <span className="text-tomato">fehlgeschlagen</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {notice && (
          <div className="mt-3">
            <Alert variant="info">{notice}</Alert>
          </div>
        )}
        {error && (
          <div className="mt-3">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {status === "done" && anyQueued && (
          <Link
            href="/review"
            onClick={() => setOpen(false)}
            className="press mt-4 flex h-12 w-full items-center justify-center rounded-full bg-accent font-bold text-white"
          >
            Zu Prüfen →
          </Link>
        )}
      </BottomSheet>
    </div>
  );
}
