"use client";

import imageCompression from "browser-image-compression";
import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { getUploadTarget, finalizeCapture } from "./actions";

export type CaptureStatus = "idle" | "working" | "done" | "error";

export interface Shot {
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
 * The capture pipeline as a hook, shared by the full-page /aufnahme panel and
 * the bottom-sheet launcher. Each selected photo is compressed (HEIC→JPEG,
 * ≤~600KB, ≤1600px), hashed, uploaded to the private raw bucket via a signed
 * URL, then finalized (creates the post + triggers the worker). Multi-shot;
 * errors never silently lose a photo; the raw image only ever goes to our
 * private bucket — nothing here changes the privacy/redaction path.
 */
export function useCapture() {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [error, setError] = useState<string | null>(null);
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
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  async function processOne(file: File, shotId: string) {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.6,
      maxWidthOrHeight: 1600,
      fileType: "image/jpeg",
      useWebWorker: true,
    });

    const sourceHash = await sha256Hex(compressed);

    const target = await getUploadTarget();
    if (!target.ok || !target.path || !target.token) {
      throw new Error(target.message ?? "upload");
    }

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

    const res = await finalizeCapture(target.path, sourceHash);
    if (!res.ok) {
      if (res.duplicate) {
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

  // Expose callbacks (never the raw refs) so render code doesn't read
  // `.current` during render — keeps the react-hooks/refs rule satisfied.
  const openCamera = () => cameraInputRef.current?.click();
  const openGallery = () => galleryInputRef.current?.click();

  return {
    cameraInputRef,
    galleryInputRef,
    openCamera,
    openGallery,
    status,
    error,
    notice,
    shots,
    handleFiles,
    working: status === "working",
  };
}
