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
  email_digest_opt_in: boolean;
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
  redacted_image_path: string | null;
  extraction: unknown;
  published_at: string | null;
  created_at: string;
}
