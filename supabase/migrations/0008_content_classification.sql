-- =============================================================================
-- 0008_content_classification.sql — additive content-type classification
-- =============================================================================
-- Adds WHAT-KIND-of-notice classification + routing. Strictly additive; does not
-- alter applied migrations and does not touch posts.category (the legacy feed
-- facet) or the live RLS/grant surface beyond re-granting the new safe columns.
--
-- Decisions (synthesis of the three designs; base = Design 0):
--   * content_type is a NEW text+CHECK column on posts (matches every enum-like
--     column in 0001-0007 — role/status/org_type/event.category — none use a pg
--     ENUM). A 6th type later is a 1-line CHECK swap, not ALTER TYPE.
--   * Two columns encode "LLM advises, code decides":
--       content_type_suggested = the LLM suggestion (advisory, admin-only).
--       content_type           = the admin-CONFIRMED value; the ONLY value
--                                routing reads. NULL until review confirms it.
--     content_type is INTENTIONALLY nullable with NO default: a NULL means
--     "unclassified / not yet confirmed", which is distinct from the 'info'
--     fallback. (Design 1/2 defaulted to 'info' and conflated in-flight rows
--     with the real fallback; rejected.)
--   * ONE generic detail table post_details (1:1 with a post) holds the admin-
--     edited, queryable structured payload for meal_plan/reflection (and an
--     optional health snapshot). Smallest additive surface; a future type adds
--     ZERO tables/policies/grants. Raw LLM stays immutable in posts.extraction;
--     post_details is the post-confirmation, render-from copy that survives edits
--     with no LLM re-run.
--   * Nutri-Score is broken out into typed columns with nutri_is_estimate hard-
--     defaulted true, so it can never be stored/read as official.
--   * event_notice reuses the existing events table + ICS (nothing new).
--   * health_notice + info live in posts.extraction (already member-exposed);
--     health severity is also surfaced as a typed column for the alert ordering.
--
-- Handles the two verified fit-gotchas from migrations 0003/0004/0006:
--   (A) 0004 did `revoke select on posts from authenticated` + a FIXED column
--       grant, so a new posts column is member-INVISIBLE unless re-granted. We
--       re-grant the new member-safe columns (NOT content_type_suggested).
--   (B) 0003's posts_public (security_invoker) is the member read path; it must
--       be refreshed to expose the new columns. We `create or replace` it with
--       the exact 0003 column list + the new safe columns.
--   (C) 0006 made *_superadmin_all (is_superadmin(), cross-org) the house
--       pattern; post_details gets a matching superadmin_all policy.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- posts: classification + alert-severity + nutri-hide columns.
-- text+CHECK to match every other enum-like column in the schema. No default on
-- content_type: NULL = unconfirmed (distinct from the 'info' fallback).
-- -----------------------------------------------------------------------------
alter table public.posts
  add column if not exists content_type text
    check (content_type is null or content_type in
      ('meal_plan','reflection','health_notice','event_notice','info')),
  add column if not exists content_type_suggested text
    check (content_type_suggested is null or content_type_suggested in
      ('meal_plan','reflection','health_notice','event_notice','info')),
  add column if not exists health_severity text
    check (health_severity is null or health_severity in ('info','advisory','urgent')),
  add column if not exists nutri_score_hidden boolean not null default false;

comment on column public.posts.content_type is
  'Admin-CONFIRMED notice kind; the ONLY value routing reads. NULL until review.';
comment on column public.posts.content_type_suggested is
  'LLM-SUGGESTED kind (advisory, admin-only). Admin confirms it into content_type.';
comment on column public.posts.health_severity is
  'For health_notice posts: drives alert prominence/ordering. NULL otherwise.';
comment on column public.posts.nutri_score_hidden is
  'Admin toggle to suppress the estimated Nutri-Score in the meal_plan section.';

-- Section pages list published posts of one type per org -> indexed lookup, not a
-- jsonb scan. Partial index keeps it lean (only the published rows sections read).
create index if not exists posts_org_content_type_idx
  on public.posts(org_id, content_type)
  where status = 'published';

-- -----------------------------------------------------------------------------
-- post_details — ONE generic table for admin-edited, render-from structured data
-- (meal_plan / reflection, optional health snapshot). 1:1 with a post (PK =
-- post_id). Holds NO PII (post-redaction structured data), so the whole table is
-- member-safe. Nutri-Score is broken out so it is ALWAYS flagged estimate and
-- never confused with an official score. payload jsonb absorbs the per-type
-- shape (days/dishes/activities) without a table per type; section rendering does
-- not need column-level querying of the payload (the org+type lookup is the index
-- above on posts, joined here by post_id).
-- -----------------------------------------------------------------------------
create table public.post_details (
  post_id            uuid primary key references public.posts(id) on delete cascade,
  org_id             uuid not null references public.orgs(id) on delete cascade,
  content_type       text not null
                       check (content_type in ('meal_plan','reflection','health_notice')),
  -- meal_plan : {"week_of":"2026-06-08",
  --              "days":[{"day":"mon","date":"2026-06-08",
  --                       "dishes":[...],"nutri_score":"B","nutri_rationale":"..."}]}
  -- reflection: {"week_of":"2026-06-08",
  --              "days":[{"day":"mon","date":"2026-06-08","summary":"...","activities":[...]}]}
  -- health    : {"topic":"...","action_required":"...","date":null,"ends_on":null}
  payload            jsonb not null,
  -- Per-WEEK rollup Nutri-Score estimate (per-DAY estimates live in payload.days[]).
  nutri_score        text check (nutri_score is null or nutri_score in ('A','B','C','D','E')),
  nutri_is_estimate  boolean not null default true,   -- hard true; never official
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index post_details_org_type_idx on public.post_details(org_id, content_type);

comment on table public.post_details is
  'Admin-edited structured payload for meal_plan/reflection (+ optional health) '
  'posts. Survives edits, renders without re-running the LLM. The raw LLM output '
  'stays immutable in posts.extraction. nutri_score is ALWAYS an estimate.';
comment on column public.post_details.nutri_score is
  'Per-WEEK Nutri-Score ESTIMATE (A-E). Per-day estimates are in payload.days[]. '
  'NEVER an official score; always rendered with a "Schaetzung" label.';

-- -----------------------------------------------------------------------------
-- RLS — mirror posts exactly: members read published-in-own-org; admins full
-- in-org; superadmins cross-org. ENABLE + FORCE per house style (0001).
-- -----------------------------------------------------------------------------
alter table public.post_details enable row level security;
alter table public.post_details force row level security;

-- Member: own-org AND the parent post is published. (org_id is also pinned so a
-- mis-set org_id row can never leak across tenants.)
create policy post_details_member_read on public.post_details
  for select to authenticated
  using (
    org_id = public.my_org_id()
    and exists (
      select 1 from public.posts p
      where p.id = post_details.post_id and p.status = 'published'
    )
  );

-- Admin (is_admin() = admin OR superadmin): full access within own org.
create policy post_details_admin_all on public.post_details
  for all to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

-- Superadmin: cross-org full access (operator support/debugging) — matches the
-- *_superadmin_all pattern introduced in 0006.
create policy post_details_superadmin_all on public.post_details
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- post_details holds no PII -> whole-table SELECT for authenticated is member-safe
-- (RLS above still governs WHICH rows). Explicit + idempotent.
grant select on public.post_details to authenticated;

-- -----------------------------------------------------------------------------
-- (A) Re-grant the new member-safe columns on posts. 0004 REVOKE'd whole-table
-- SELECT then re-granted a FIXED column list, so without this members cannot read
-- content_type / health_severity / nutri_score_hidden at all.
-- content_type_suggested is admin-only review metadata -> deliberately NOT granted.
-- -----------------------------------------------------------------------------
grant select (content_type, health_severity, nutri_score_hidden)
  on public.posts to authenticated;

-- -----------------------------------------------------------------------------
-- (B) Refresh the member view to expose the new columns. Reproduces the exact
-- 0003 column list (incl. created_by per the 0004 grant) + the new safe columns.
-- security_invoker => posts RLS still governs rows; PII + content_type_suggested
-- stay omitted. The view can only narrow, never widen.
--
-- We DROP then CREATE (not CREATE OR REPLACE): the new safe columns are inserted
-- mid-list (after category), and CREATE OR REPLACE VIEW only allows APPENDING
-- columns, never reordering — it errors with "cannot change name of view column".
-- Dropping is safe: nothing else depends on this view (members query it directly).
-- -----------------------------------------------------------------------------
drop view if exists public.posts_public;
create view public.posts_public
with (security_invoker = on)
as
  select
    id, org_id, status, title, body, category,
    content_type, health_severity, nutri_score_hidden,
    redacted_image_path, extraction,
    published_at, created_by, created_at
  from public.posts
  where status = 'published';

grant select on public.posts_public to authenticated;

comment on view public.posts_public is
  'Member-facing read of posts. Omits source_image_path, ocr_text_raw, '
  'ocr_text_redacted, redactions, and content_type_suggested. Exposes the '
  'admin-confirmed content_type + health_severity + nutri_score_hidden. '
  'security_invoker=on so RLS on posts still governs row visibility.';
