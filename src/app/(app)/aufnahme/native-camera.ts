"use client";

/**
 * Native camera bridge (Capacitor). When the app runs inside the native shell
 * (`Capacitor.isNativePlatform()`), this returns a photo as a File so it can flow
 * through the EXACT same compress → hash → upload → finalize pipeline as a
 * browser <input> file — the privacy/redaction path is unchanged. On the web this
 * is never called (the caller checks isNative first), so importing it is inert.
 *
 * This module is loaded via dynamic import so @capacitor/* never weighs on the
 * web bundle.
 */

import { Capacitor } from "@capacitor/core";

/** True only inside the Capacitor native shell. Safe to call on the web. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Take ONE photo with the native camera (or pick from the gallery). Returns a
 * single-element File array (the existing pipeline is multi-shot, so an array
 * keeps the call sites uniform), or [] if the user cancelled.
 */
export async function getNativePhoto(
  source: "camera" | "gallery",
): Promise<File[]> {
  const { Camera, CameraResultType, CameraSource } =
    await import("@capacitor/camera");
  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      // We re-compress downstream anyway; allow editing off for speed.
      allowEditing: false,
      // Get raw bytes back as a data URL so we can build a File without needing
      // filesystem read permissions.
      resultType: CameraResultType.DataUrl,
      source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
    });
    if (!photo.dataUrl) return [];
    const file = await dataUrlToFile(
      photo.dataUrl,
      `capture-${Date.now()}.jpg`,
    );
    return [file];
  } catch {
    // Capacitor throws on user-cancel; treat as "no photos", not an error.
    return [];
  }
}

/** Convert a data: URL to a File (so it reuses the web upload pipeline). */
async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}
