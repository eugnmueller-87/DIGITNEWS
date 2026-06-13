"use client";

import imageCompression from "browser-image-compression";
import Link from "next/link";
import { useRef, useState } from "react";

import { Card, Alert } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

import { getUploadTarget, finalizeCapture } from "./actions";

type Status = "idle" | "working" | "done" | "error";

interface Shot {
  id: string;
  state: "uploading" | "processing" | "queued" | "failed";
}

/**
 * Capture UI. Pick/take a photo → compress client-side (HEIC→JPEG, ≤~600KB,
 * max 1600px) → upload to the private raw bucket via a signed URL → finalize
 * (creates the post + triggers the worker). Multi-shot: each photo becomes its
 * own draft. Errors never silently lose a photo.
 */
export function CapturePanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
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
    if (inputRef.current) inputRef.current.value = "";
  }

  async function processOne(file: File, shotId: string) {
    // 1. Compress + re-encode to JPEG (solves HEIC), cap size/dimensions.
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.6,
      maxWidthOrHeight: 1600,
      fileType: "image/jpeg",
      useWebWorker: true,
    });

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
    const res = await finalizeCapture(target.path);
    if (!res.ok) throw new Error(res.message ?? "finalize");

    setShots((s) =>
      s.map((x) =>
        x.id === shotId
          ? { ...x, state: res.triggered ? "queued" : "processing" }
          : x,
      ),
    );
  }

  return (
    <Card>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "working"}
        className="flex w-full flex-col items-center gap-1 rounded-3xl border-[3px] border-dashed border-ink-soft bg-sky/25 px-6 py-8 text-center transition-colors hover:bg-sky/50 disabled:opacity-60"
      >
        <span className="text-4xl leading-none" aria-hidden>
          📷
        </span>
        <span className="font-display text-xl font-semibold text-ink">
          {status === "working"
            ? "Wird verarbeitet …"
            : "Foto vom Aushang aufnehmen"}
        </span>
        <span className="text-sm font-semibold text-ink-soft">
          Tippen zum Fotografieren · auch schräg oder unscharf ist okay
        </span>
      </button>

      {shots.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm">
          {shots.map((shot, i) => (
            <li key={shot.id} className="flex items-center justify-between">
              <span className="text-zinc-600 dark:text-zinc-300">
                Foto {i + 1}
              </span>
              <span className="text-xs text-zinc-400">
                {shot.state === "uploading" && "lädt hoch …"}
                {shot.state === "processing" && "wird ausgelesen …"}
                {shot.state === "queued" && "in Bearbeitung ✓"}
                {shot.state === "failed" && (
                  <span className="text-red-500">fehlgeschlagen</span>
                )}
              </span>
            </li>
          ))}
        </ul>
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
