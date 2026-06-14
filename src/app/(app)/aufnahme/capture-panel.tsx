"use client";

import Link from "next/link";

import { Icon } from "@/components/icons";
import { SunLogo } from "@/components/sun-logo";
import { Alert } from "@/components/ui";

import { useCapture } from "./use-capture";

/**
 * Full-page capture fallback (the /aufnahme route, and desktop). A big circular
 * shutter (camera) with a quiet "Aus Galerie wählen" secondary, then a live
 * per-shot progress list. Shares the exact pipeline with the phone FAB sheet
 * via useCapture; the camera input keeps capture="environment", the gallery one
 * has none. Nothing changes the privacy/upload path.
 */
export function CapturePanel() {
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

  return (
    <div className="flex flex-col items-center">
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

      {/* Big shutter */}
      <button
        type="button"
        onClick={() => openCamera()}
        disabled={working}
        aria-label="Foto aufnehmen"
        className="press flex h-24 w-24 items-center justify-center rounded-full bg-accent text-white shadow-float disabled:opacity-60"
      >
        {working ? (
          <SunLogo className="h-10 w-10" spinning />
        ) : (
          <Icon name="capture" size={36} />
        )}
      </button>
      <p className="mt-3 font-display text-lg font-bold text-ink">
        {working ? "Wird verarbeitet …" : "Aushang fotografieren"}
      </p>

      <button
        type="button"
        onClick={() => openGallery()}
        disabled={working}
        className="press mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-paper px-4 py-2 text-sm font-bold text-ink disabled:opacity-60"
      >
        <Icon name="image" size={16} className="text-ink-soft" />
        Aus Galerie wählen
      </button>

      <p className="mt-4 text-center text-sm text-ink-soft">
        Auch schräg oder unscharf ist okay.
      </p>

      <div className="mt-6 w-full max-w-md">
        {shots.length > 0 && (
          <ul className="space-y-2">
            {shots.map((shot, i) => (
              <li
                key={shot.id}
                className="flex items-center justify-between rounded-[12px] border border-border bg-paper px-4 py-2.5 text-sm"
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

        {status === "done" &&
          shots.some(
            (s) => s.state === "queued" || s.state === "processing",
          ) && (
            <div className="mt-3">
              <Alert variant="success">
                Erledigt! Sobald die Aushänge ausgelesen sind, findest du sie
                unter{" "}
                <Link href="/review" className="font-bold underline">
                  Prüfen
                </Link>
                .
              </Alert>
            </div>
          )}
      </div>
    </div>
  );
}
