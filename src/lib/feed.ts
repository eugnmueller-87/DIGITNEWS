/**
 * Pure feed logic — kept out of the server component so it is unit-testable
 * without rendering React. The feed page (server component) does the RLS-scoped
 * Supabase query and hands the rows here for ordering/partitioning.
 */

import type { HealthSeverity } from "@/lib/database.types";

/** Health alert as surfaced at the top of the feed (subset of PublicPost).
 *  Carries the same render inputs as a FeedPost so a pinned alert can be shown
 *  as a fully tappable FeedCard (detail sheet with body + payload + photo), not
 *  just a static block. */
export interface FeedAlert {
  id: string;
  title: string | null;
  body: string | null;
  health_severity: HealthSeverity | null;
  published_at: string | null;
  extraction?: { payload?: unknown } | null;
  redacted_image_path?: string | null;
  cover_image_path?: string | null;
}

/** A general (non-alert) feed card. */
export interface FeedPost {
  id: string;
  title: string | null;
  body: string | null;
  published_at: string | null;
  /** Confirmed content type (null = unconfirmed; renders as info to members). */
  content_type?: string | null;
}

/** The assembled, ordered view the feed page renders. */
export interface FeedView {
  alerts: FeedAlert[];
  posts: FeedPost[];
  loadFailed: boolean;
}

/** Lower number = higher priority. null severity is treated as "info". */
const SEVERITY_RANK: Record<HealthSeverity, number> = {
  urgent: 0,
  advisory: 1,
  info: 2,
};

function severityRank(s: HealthSeverity | null): number {
  return s ? SEVERITY_RANK[s] : SEVERITY_RANK.info;
}

/**
 * Order health alerts urgent → advisory → info, then newest-first within the
 * same severity. Pure and stable; does NOT mutate the input array.
 *
 * Why this matters: health_severity is a text+CHECK column, NOT a real enum, so
 * a DB ORDER BY on it sorts alphabetically (advisory < info < urgent) — wrong.
 * The query therefore fetches newest-first with a generous cap and the correct
 * severity order is imposed HERE, so an older-but-urgent alert (lice, illness)
 * is never dropped by a row limit before it is ranked.
 */
export function sortHealthAlerts<T extends FeedAlert>(
  alerts: readonly T[],
): T[] {
  return [...alerts].sort((a, b) => {
    const bySeverity =
      severityRank(a.health_severity) - severityRank(b.health_severity);
    if (bySeverity !== 0) return bySeverity;
    // Newest first within a severity. Nulls sort last.
    const at = a.published_at ?? "";
    const bt = b.published_at ?? "";
    return bt.localeCompare(at);
  });
}

/**
 * Assemble the feed view from the two raw query results. Centralizes the
 * decisions the page makes so they are testable as one unit: alerts get the
 * severity ordering; a query error is surfaced (not silently shown as empty);
 * `null` data coalesces to empty lists.
 */
export function buildFeedView(
  alerts: { data: FeedAlert[] | null; error: unknown },
  posts: { data: FeedPost[] | null; error: unknown },
): FeedView {
  return {
    alerts: sortHealthAlerts(alerts.data ?? []),
    posts: posts.data ?? [],
    loadFailed: Boolean(alerts.error) || Boolean(posts.error),
  };
}
