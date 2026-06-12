import "server-only";

import webpush from "web-push";

import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Web Push (VAPID) — subscribe/unsubscribe a browser, and fan-out to an org. */

let configured = false;
function ensureConfigured(): boolean {
  if (!publicEnv.vapidPublicKey || !serverEnv.vapidPrivateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(
      serverEnv.vapidSubject,
      publicEnv.vapidPublicKey,
      serverEnv.vapidPrivateKey,
    );
    configured = true;
  }
  return true;
}

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Save a browser push subscription for a user (idempotent on endpoint). */
export async function saveSubscription(
  profileId: string,
  orgId: string,
  sub: PushSub,
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("push_subscriptions").upsert(
    {
      profile_id: profileId,
      org_id: orgId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
    { onConflict: "endpoint" },
  );
}

/** Remove a subscription by endpoint (unsubscribe). */
export async function removeSubscription(endpoint: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

/**
 * Push a notification to every subscriber in an org. Best-effort: dead
 * subscriptions (410/404) are pruned. Never throws to the caller.
 */
export async function pushToOrg(
  orgId: string,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  if (!ensureConfigured()) return;
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("org_id", orgId);

  const body = JSON.stringify(payload);
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
        }
      }
    }),
  );
}
