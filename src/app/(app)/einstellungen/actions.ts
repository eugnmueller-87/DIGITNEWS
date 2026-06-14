"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth";
import { createIcsToken, revokeIcsTokens } from "@/lib/ics";
import { saveSubscription, removeSubscription, type PushSub } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface SettingsState {
  ok: boolean;
  message: string | null;
}

/** Create (or rotate) the caller's calendar subscription token. */
export async function enableCalendarSub(): Promise<SettingsState> {
  const session = await requireSession();
  try {
    await createIcsToken(session.userId);
  } catch {
    return { ok: false, message: "Konnte Kalender-Abo nicht erstellen." };
  }
  revalidatePath("/einstellungen");
  return { ok: true, message: "Kalender-Abo aktiviert." };
}

/** Revoke the caller's calendar tokens (unsubscribe / rotate). */
export async function disableCalendarSub(): Promise<SettingsState> {
  const session = await requireSession();
  try {
    await revokeIcsTokens(session.userId);
  } catch {
    return { ok: false, message: "Konnte Abo nicht widerrufen." };
  }
  revalidatePath("/einstellungen");
  return { ok: true, message: "Abo widerrufen." };
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
  const admin = createAdminClient();
  const { error } = await admin.rpc("delete_own_account", {
    p_user_id: session.userId,
  });
  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("last admin")) {
      return {
        ok: false,
        message:
          "Du bist die letzte Administrator:in. Übergib zuerst die Rolle oder lösche die Organisation.",
      };
    }
    return { ok: false, message: "Konnte das Konto nicht löschen." };
  }
  // Clear the now-orphaned session and leave.
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
