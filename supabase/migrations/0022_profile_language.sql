-- =============================================================================
-- 0022_profile_language.sql — per-user UI language preference (de | en)
-- =============================================================================
-- A member can choose to use the app in English. This stores the choice on the
-- profile. profiles was never column-REVOKE'd, and profiles_update_self already
-- lets a member self-update their own row (role/org pinned) — exactly like
-- email_digest_opt_in / photo_consent — so NO new grant is needed. Existing rows
-- default to 'de' (zero backfill, no behavior change). No RPC/business-logic
-- change: it's a pure profile attribute the member sets via the RLS client.
-- =============================================================================

alter table public.profiles
  add column if not exists language text not null default 'de'
    check (language in ('de', 'en'));
