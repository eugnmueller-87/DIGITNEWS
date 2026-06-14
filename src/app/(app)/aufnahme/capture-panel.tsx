"use client";

import imageCompression from "browser-image-compression";
import Link from "next/link";
import { useRef, useState } from "react";

import { Card, Alert } from "@/components/ui";
import { clsx } from "@/lib/clsx";
import { createClient } from "@/lib/supabase/client";

import { getUploadTarget, finalizeCapture } from "./actions";

type Status = "idle" | "working" | "done" | "error";

interface Shot {
  id: string;
  state: "uploading" | "processing" | "queued" | "failed" | "duplicate";
}

/** SHA-256 (hex) of a Blob's bytes — identifies an exact-duplicate capture. */
async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Capture UI. Two intuitive sources — like any phone app:
 *   • „Foto aufnehmen" → opens the rear camera (input with capture="environment")
 *   • „Aus Galerie wählen" → opens the OS photo library / file picker (input
 *     WITHOUT a capture attribute, so the OS offers album + files; on desktop
 *     this is just the normal file dialog).
 *
 * A single input cannot offer both: `capture` either forces the camera or it
 * doesn't. So we keep two hidden inputs and one shared handler. Everything after
 * selection is unchanged — compress client-side (HEIC→JPEG, ≤~600KB, max
 * 1600px) → upload to the private raw bucket via a signed URL → finalize
 * (creates the post + triggers the worker). Multi-shot: each photo becomes its
 * own draft. Errors never silently lose a photo. The raw image still goes only
 * to our private bucket; nothing here changes the privacy/redaction path.
 */
export function CapturePanel() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  // A non-error info notice (e.g. "this photo was already captured").
  const [notice, setNotice] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setNotice(null);
    setStatus("working");

    for (const file of Array.from(files)) {
      const shotId = crypto.randomUUID();
      setShots((s) => [...s, { id: shotId, state: "uploading" }]);
      try {
        await processOne(file, shotId);
      } catch {
        setShots((s) =>
          s.map((x) => (x.id === shotId ? { ...x, state: "failed" } : x)),
        );
        setError(
          "Ein Foto konnte nicht verarbeitet werden. Bitte erneut versuchen.",
        );
      }
    }
    setStatus("done");
    // Reset BOTH inputs so picking the same file again still fires onChange.
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  async function processOne(file: File, shotId: string) {
    // 1. Compress + re-encode to JPEG (solves HEIC), cap size/dimensions.
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.6,
      maxWidthOrHeight: 1600,
      fileType: "image/jpeg",
      useWebWorker: true,
    });

    // 1b. Hash the bytes we're about to upload — the server rejects an exact
    //     re-capture of the same photo for this org ("already posted").
    const sourceHash = await sha256Hex(compressed);

    // 2. Get a signed upload target from the server.
    const target = await getUploadTarget();
    if (!target.ok || !target.path || !target.token) {
      throw new Error(target.message ?? "upload");
    }

    // 3. Upload directly to the private bucket via the signed URL.
    const supabase = createClient();
    const { error: upErr } = await supabase.storage
      .from("raw-photos")
      .uploadToSignedUrl(target.path, target.token, compressed, {
        contentType: "image/jpeg",
      });
    if (upErr) throw new Error("upload");

    setShots((s) =>
      s.map((x) => (x.id === shotId ? { ...x, state: "processing" } : x)),
    );

    // 4. Finalize: create the post + trigger the worker.
    const res = await finalizeCapture(target.path, sourceHash);
    if (!res.ok) {
      if (res.duplicate) {
        // Not an error — the photo was already captured. Mark this shot and
        // surface the specific message; don't flip the whole panel to "error".
        setShots((s) =>
          s.map((x) => (x.id === shotId ? { ...x, state: "duplicate" } : x)),
        );
        setNotice(res.message ?? "Dieser Aushang wurde bereits aufgenommen.");
        return;
      }
      throw new Error(res.message ?? "finalize");
    }

    setShots((s) =>
      s.map((x) =>
        x.id === shotId
          ? { ...x, state: res.triggered ? "queued" : "processing" }
          : x,
      ),
    );
  }

  const working = status === "working";

  return (
    <Card>
      {/* Hidden inputs — one per source. */}
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

      {/* Two clear, thumb-sized actions. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={working}
          className={clsx(
            "flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-[18px] border border-dashed border-border bg-sage-soft px-6 py-7 text-center transition-colors",
            "hover:bg-sun-soft disabled:opacity-60",
          )}
        >
          <span className="text-4xl leading-none" aria-hidden>
            📷
          </span>
          <span className="font-display text-lg font-semibold text-ink">
            {working ? "Wird verarbeitet …" : "Foto aufnehmen"}
          </span>
          <span className="text-sm font-semibold text-ink-soft">
            Kamera öffnen
          </span>
        </button>

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={working}
          className={clsx(
            "flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-[18px] border border-dashed border-border bg-paper px-6 py-7 text-center transition-colors",
            "hover:bg-sun-soft disabled:opacity-60",
          )}
        >
          <span className="text-4xl leading-none" aria-hidden>
            🖼️
          </span>
          <span className="font-display text-lg font-semibold text-ink">
            Aus Galerie wählen
          </span>
          <span className="text-sm font-semibold text-ink-soft">
            Galerie oder Dateien
          </span>
        </button>
      </div>

      <p className="mt-3 text-center text-sm font-semibold text-ink-soft">
        Auch schräg oder unscharf ist okay.
      </p>

      {shots.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm">
          {shots.map((shot, i) => (
            <li key={shot.id} className="flex items-center justify-between">
              <span className="font-semibold text-ink">Foto {i + 1}</span>
              <span className="text-xs font-semibold text-ink-soft">
                {shot.state === "uploading" && "lädt hoch …"}
                {shot.state === "processing" && "wird ausgelesen …"}
                {shot.state === "queued" && "in Bearbeitung ✓"}
                {shot.state === "duplicate" && (
                  <span className="text-ink-soft">bereits aufgenommen</span>
                )}
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
        shots.some((s) => s.state === "queued" || s.state === "processing") && (
          <div className="mt-3">
            <Alert variant="success">
              Erledigt! Sobald die Aushänge ausgelesen sind, findest du sie
              unter{" "}
              <Link href="/review" className="font-medium underline">
                Prüfen
              </Link>
              .
            </Alert>
          </div>
        )}
    </Card>
  );
}
