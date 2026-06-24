"use client";

import { Icon } from "@/components/icons";
import { SunLogo } from "@/components/sun-logo";
import { Alert } from "@/components/ui";
import { fmt } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/provider";

import { useCapture } from "./use-capture";

/**
 * Full-page capture fallback (the /aufnahme route, and desktop). A big circular
 * shutter (camera) with a quiet "Aus Galerie wählen" secondary, then a live
 * per-shot progress list. Shares the exact pipeline with the phone FAB sheet
 * via useCapture; the camera input keeps capture="environment", the gallery one
 * has none. Nothing changes the privacy/upload path.
 */
export function CapturePanel() {
  const t = useT();
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
    confirmDuplicate,
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
        aria-label={t.aufnahme.takePhoto}
        className="press flex h-24 w-24 items-center justify-center rounded-full bg-accent text-white shadow-float disabled:opacity-60"
      >
        {working ? (
          <SunLogo className="h-10 w-10" spinning />
        ) : (
          <Icon name="capture" size={36} />
        )}
      </button>
      <p className="mt-3 font-display text-lg font-bold text-ink">
        {working ? t.aufnahme.processing : t.aufnahme.title}
      </p>

      <button
        type="button"
        onClick={() => openGallery()}
        disabled={working}
        className="press mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-paper px-4 py-2 text-sm font-bold text-ink disabled:opacity-60"
      >
        <Icon name="image" size={16} className="text-ink-soft" />
        {t.aufnahme.fromGallery}
      </button>

      <p className="mt-4 text-center text-sm text-ink-soft">
        {t.aufnahme.crookedOk}
      </p>

      <div className="mt-6 w-full max-w-md">
        {shots.length > 0 && (
          <ul className="space-y-2">
            {shots.map((shot, i) => (
              <li
                key={shot.id}
                className="flex items-center justify-between rounded-[12px] border border-border bg-paper px-4 py-2.5 text-sm"
              >
                <span className="font-semibold text-ink">
                  {fmt(t.aufnahme.shot, { n: i + 1 })}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                  {(shot.state === "uploading" ||
                    shot.state === "processing") && (
                    <>
                      <SunLogo className="h-4 w-4" spinning />
                      {shot.state === "uploading"
                        ? t.aufnahme.uploading
                        : t.aufnahme.reading}
                    </>
                  )}
                  {shot.state === "queued" && (
                    <span className="flex items-center gap-1 text-sage">
                      <Icon name="check" size={14} /> {t.aufnahme.queued}
                    </span>
                  )}
                  {shot.state === "duplicate" && (
                    <span className="flex items-center gap-2">
                      <span className="text-ink-soft">
                        {t.aufnahme.duplicate}
                      </span>
                      <button
                        type="button"
                        onClick={() => void confirmDuplicate(shot.id)}
                        className="press rounded-full bg-accent px-3 py-1 text-xs font-bold text-white"
                      >
                        {t.aufnahme.uploadAnyway}
                      </button>
                    </span>
                  )}
                  {shot.state === "failed" && (
                    <span className="text-tomato">{t.aufnahme.failed}</span>
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
              <Alert variant="success">{t.aufnahme.done}</Alert>
            </div>
          )}
      </div>
    </div>
  );
}
