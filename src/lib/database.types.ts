/**
 * Minimal hand-authored database types for Phase 1.
 *
 * In a later phase, generate the full type set with:
 *   supabase gen types typescript --linked > src/lib/database.types.ts
 * and delete this hand-written stub. For now this covers only what the
 * skeleton queries, keeping the build typed without requiring a live project.
 */

export type Role = "superadmin" | "admin" | "member";
export type MembershipStatus = "invited" | "active";
export type OrgType = "kita" | "verein" | "kirche" | "betrieb" | "sonstiges";
export type PostStatus =
  | "processing"
  | "draft"
  | "published"
  | "archived"
  | "failed";
export type PostCategory = "event" | "deadline" | "call_to_action" | "info";
export type EventCategory = "closure" | "event" | "deadline";
export type EventStatus = "pending" | "confirmed" | "cancelled";

// Content classification (migration 0008). See src/lib/content/types.ts for the
// full payload shapes; these are the column-level types.
export type ContentType =
  | "meal_plan"
  | "reflection"
  | "health_notice"
  | "event_notice"
  | "info";
export type HealthSeverity = "info" | "advisory" | "urgent";
export type NutriScore = "A" | "B" | "C" | "D" | "E";

export interface Org {
  id: string;
  name: string;
  slug: string;
  org_type: OrgType;
  created_at: string;
}

export interface Profile {
  id: string;
  org_id: string;
  role: Role;
  membership_status: MembershipStatus;
  display_name: string | null;
  group_id: string | null;
  email_digest_opt_in: boolean;
  /** Member opt-in to seeing the CLEAR (original) photo where the admin released it (0020). */
  photo_consent: boolean;
  /** Preferred UI language (0022); 'de' default. */
  language: "de" | "en";
  created_at: string;
}

export interface Group {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
}

/** Member-facing post shape (from the posts_public view; no PII columns). */
export interface PublicPost {
  id: string;
  org_id: string;
  status: PostStatus;
  title: string | null;
  body: string | null;
  category: PostCategory | null;
  content_type: ContentType | null;
  health_severity: HealthSeverity | null;
  nutri_score_hidden: boolean;
  redacted_image_path: string | null;
  /** Generated decorative cover (text-to-image; non-PII). 0023. */
  cover_image_path: string | null;
  extraction: unknown;
  published_at: string | null;
  created_at: string;
}

/**
 * Server-only post fields needed to decide which image a member sees (0020).
 * Read from the `posts` table via the SERVICE ROLE (org-scoped) — NOT exposed in
 * posts_public: source_image_path is PII (REVOKE'd from `authenticated`, 0004)
 * and clear_photo_allowed is never read directly by members.
 */
export interface PostImageGate {
  id: string;
  source_image_path: string | null;
  clear_photo_allowed: boolean;
}

/** Admin-edited structured detail for meal_plan / reflection / health posts. */
export interface PostDetails {
  post_id: string;
  org_id: string;
  content_type: "meal_plan" | "reflection" | "health_notice";
  payload: unknown; // see src/lib/content/types.ts for per-type shapes
  nutri_score: NutriScore | null;
  nutri_is_estimate: boolean;
  created_at: string;
  updated_at: string;
}
