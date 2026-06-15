"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n/types";
import { createIcsToken, revokeIcsTokens } from "@/lib/ics";
import { saveSubscription, removeSubscription, type PushSub } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface SettingsState {
  ok: boolean;
  message: string | null;
}

/**
 * Set the caller's UI language (RLS-governed self-update). Also writes the
 * `locale` cookie so the root <html lang> + any pre-session render match
 * immediately, and revalidates the whole layout so the shell re-renders in the
 * new language without a full reload.
 */
export async function setLanguage(locale: Locale): Promise<SettingsState> {
  const dict = await getDict();
  if (!isLocale(locale)) {
    return { ok: false, message: dict.settings.languageInvalid };
  }
  const session = await requireSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ language: locale })
    .eq("id", session.userId);
  if (error) {
    return { ok: false, message: dict.common.saveFailed };
  }
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  return { ok: true, message: null };
}

/** Create (or rotate) the caller's calendar subscription token. */
export async function enableCalendarSub(): Promise<SettingsState> {
  const session = await requireSession();
  const dict = await getDict();
  try {
    await createIcsToken(session.userId);
  } catch {
    return { ok: false, message: dict.actions.calSubCreateFailed };
  }
  revalidatePath("/einstellungen");
  return { ok: true, message: null };
}

/** Revoke the caller's calendar tokens (unsubscribe / rotate). */
export async function disableCalendarSub(): Promise<SettingsState> {
  const session = await requireSession();
  const dict = await getDict();
  try {
    await revokeIcsTokens(session.userId);
  } catch {
    return { ok: false, message: dict.actions.calSubRevokeFailed };
  }
  revalidatePath("/einstellungen");
  return { ok: true, message: dict.actions.calSubRevoked };
}

/** Toggle the email-digest opt-in on the caller's own profile (RLS-governed). */
export async function setDigestOptIn(optIn: boolean): Promise<SettingsState> {
  const session = await requireSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ email_digest_opt_in: optIn })
    .eq("id", session.userId);
  if (error) {
    return { ok: false, message: "Konnte Einstellung nicht speichern." };
  }
  revalidatePath("/einstellungen");
  return { ok: true, message: "Gespeichert." };
}

/**
 * Toggle the caller's photo-consent on their own profile (RLS-governed). When ON,
 * the member sees the CLEAR original photo on posts the admin has released
 * (clear_photo_allowed); when OFF they see the blurred image. Revalidate the
 * member-facing pages so the change takes effect without a manual navigation.
 */
export async function setPhotoConsent(optIn: boolean): Promise<SettingsState> {
  const session = await requireSession();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ photo_consent: optIn })
    .eq("id", session.userId);
  if (error) {
    return { ok: false, message: "Konnte Einstellung nicht speichern." };
  }
  revalidatePath("/einstellungen");
  revalidatePath("/feed");
  revalidatePath("/rueckblick");
  revalidatePath("/info");
  revalidatePath("/gesundheit");
  revalidatePath("/essensplan");
  return { ok: true, message: "Gespeichert." };
}

/** Save the caller's web-push subscription (opt-in). */
export async function subscribePush(sub: PushSub): Promise<SettingsState> {
  const session = await requireSession();
  try {
    await saveSubscription(session.userId, session.orgId, sub);
  } catch {
    return { ok: false, message: "Konnte Push nicht aktivieren." };
  }
  return { ok: true, message: "Push aktiviert." };
}

/** Remove a push subscription by endpoint (opt-out). */
export async function unsubscribePush(
  endpoint: string,
): Promise<SettingsState> {
  await requireSession();
  try {
    await removeSubscription(endpoint);
  } catch {
    return { ok: false, message: "Konnte Push nicht deaktivieren." };
  }
  return { ok: true, message: "Push deaktiviert." };
}

/**
 * Delete the caller's own account (GDPR). The definer flow refuses if they are
 * the last admin of an org (would orphan it). On success we sign out and route
 * to /login.
 */
export async function deleteOwnAccount(): Promise<SettingsState> {
  const session = await requireSession();
  const dict = await getDict();
  const admin = createAdminClient();
  const { error } = await admin.rpc("delete_own_account", {
    p_user_id: session.userId,
  });
  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("last admin")) {
      return { ok: false, message: dict.settings.deleteLastAdminError };
    }
    return { ok: false, message: dict.settings.deleteFailed };
  }
  // Clear the now-orphaned session and leave.
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
