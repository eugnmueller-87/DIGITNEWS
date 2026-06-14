import "server-only";

import { Resend } from "resend";

import { brand } from "@/config/brand";
import { serverEnv } from "@/lib/env.server";

/**
 * App-owned email sending via Resend. Used for emails WE compose (QR
 * verification now, digests later). Magic LOGIN links are sent by Supabase
 * (point Supabase SMTP at Resend) — not here.
 *
 * Graceful degradation: if RESEND_API_KEY is unset, send() returns
 * { sent: false } and logs a single warning instead of throwing. This keeps
 * local dev / CI working without a key, and makes "email not configured" a
 * visible, non-fatal state rather than a crash.
 *
 * Never log recipient PII or token-bearing URLs here.
 */

let cached: Resend | null = null;

function getClient(): Resend | null {
  if (!serverEnv.resendApiKey) return null;
  cached ??= new Resend(serverEnv.resendApiKey);
  return cached;
}

export interface SendResult {
  sent: boolean;
  reason?: "not_configured" | "error";
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) {
    // Configuration gap, not a runtime error. Surface it once, without PII.
    console.warn(
      "[email] RESEND_API_KEY not set — skipping send (subject: %s)",
      params.subject,
    );
    return { sent: false, reason: "not_configured" };
  }

  // Prefer the configured EMAIL_FROM; otherwise send from the brand's verified
  // domain (brand.supportEmail). We deliberately do NOT fall back to Resend's
  // onboarding@resend.dev test sender — that returns 403 for any recipient
  // other than the account owner, so a missing EMAIL_FROM would silently fail
  // to reach real users. The brand domain is the one verified in Resend.
  const from = serverEnv.emailFrom ?? `${brand.name} <${brand.supportEmail}>`;

  try {
    const { error } = await client.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error) {
      console.error("[email] send failed: %s", error.message);
      return { sent: false, reason: "error" };
    }
    return { sent: true };
  } catch (e) {
    console.error("[email] send threw: %s", (e as Error).message);
    return { sent: false, reason: "error" };
  }
}
