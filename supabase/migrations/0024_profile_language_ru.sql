-- =============================================================================
-- 0024_profile_language_ru.sql — allow Russian as a UI language preference
-- =============================================================================
-- 0022 added profiles.language with a CHECK limiting it to ('de','en'). We now
-- ship a full Russian translation, so widen the constraint to ('de','en','ru').
-- The inline CHECK from 0022 was auto-named `profiles_language_check`; drop and
-- recreate it with the wider allow-list. Default stays 'de'; no data changes
-- (no existing row holds 'ru'), so this is a pure constraint widening — additive
-- and backward-compatible. No grant/RLS change: language remains a member-
-- settable profile attribute (see 0022).
-- =============================================================================

alter table public.profiles
  drop constraint if exists profiles_language_check;

alter table public.profiles
  add constraint profiles_language_check
    check (language in ('de', 'en', 'ru'));
