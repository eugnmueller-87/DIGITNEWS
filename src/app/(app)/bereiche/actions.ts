"use server";

import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const CATEGORIES = [
  "feed",
  "meal_plan",
  "reflection",
  "event_notice",
  "health_notice",
  "info",
] as const;
export type SeenCategory = (typeof CATEGORIES)[number];

/**
 * Record that the caller has now seen a category (clears its "new" badge on the
 * Bereiche hub). Self-scoped via mark_category_seen (auth.uid()); best-effort —
 * a failure must never block rendering the page that called it.
 */
export async function markCategorySeen(category: SeenCategory): Promise<void> {
  if (!CATEGORIES.includes(category)) return;
  try {
    await requireSession();
    const supabase = await createClient();
    await supabase.rpc("mark_category_seen", { p_category: category });
  } catch {
    // ignore — the badge will simply stay until the next successful visit
  }
}
