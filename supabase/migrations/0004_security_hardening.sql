-- =============================================================================
-- 0004_security_hardening.sql — fixes from the Phase 1 adversarial security review
-- =============================================================================
-- This migration addresses confirmed findings. It is additive (a new migration,
-- not an edit to applied ones) per migration discipline. Apply after 0001-0003.
--
-- Findings fixed here (DB layer):
--   [CRITICAL] PII column leak: members could SELECT ocr_text_raw / redactions /
--              source_image_path / ocr_text_redacted directly from base `posts`,
--              because RLS gates ROWS not COLUMNS and Supabase grants authenticated
--              SELECT on all columns by default. -> column-level REVOKE.
--   [HIGH]     ics_tokens org_id could be moved cross-tenant via UPDATE (WITH CHECK
--              omitted org_id). -> pin org_id, forbid moving it.
--   [MEDIUM]   pgcrypto / extensions schema dependency was undeclared. -> declare it.
--   [MEDIUM]   Generated invite code could exceed the join validator's length cap
--              for long org names. -> cap the slug used in the code.
--   [CRITICAL/HIGH] Onboarding intent was carried in editable magic-link query
--              params (privilege escalation / waitlist bypass). -> server-side
--              pending_onboarding table, keyed by email, is the source of truth.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Declare the pgcrypto dependency explicitly (was relied on implicitly).
-- gen_random_bytes lives in the `extensions` schema on Supabase. Making this
-- explicit keeps the migrations portable to fresh/self-hosted/local Postgres.
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- [CRITICAL] Column-level REVOKE on posts.
-- RLS cannot restrict columns. Supabase's bootstrap grants `authenticated`
-- SELECT on every column of public.posts, so posts_member_read (rows: own org +
-- published) let a MEMBER read pre-redaction PII columns directly from the base
-- table, bypassing the posts_public view. Revoke the whole-table SELECT and
-- re-grant SELECT only on the non-PII columns. Admins are unaffected: their
-- access is via the service role / admin policies and explicit grants below.
--
-- NOTE: column-level grants apply to the `authenticated` role broadly; the
-- admin_all RLS policy still governs WHICH rows an admin may read/write, and
-- admins reach PII via the service-role server path, not the anon client. The
-- safe-column grant below is what members are limited to at the column level.
-- -----------------------------------------------------------------------------
revoke select on public.posts from authenticated;

-- Safe, member-appropriate columns only. PII columns (ocr_text_raw,
-- ocr_text_redacted, redactions, source_image_path) are deliberately EXCLUDED.
grant select (
  id, org_id, status, title, body, category,
  redacted_image_path, extraction, published_at, created_by, created_at
) on public.posts to authenticated;

-- Admins legitimately need to read/write the PII columns (the review gate). They
-- do so through the service role on the server, which has BYPASSRLS and is not
-- subject to these column grants. We do NOT grant PII columns to `authenticated`
-- at the column level, so even an admin's anon-key/browser client cannot read
-- them — admin PII access is server-only by construction. Admin write paths
-- (insert/update) continue to work via the service role.

-- The posts_public view already omits PII columns; keep it as the member read
-- path. Re-affirm the grant (idempotent).
grant select on public.posts_public to authenticated;

-- -----------------------------------------------------------------------------
-- [HIGH] ics_tokens: forbid moving a token to another org.
-- The original UPDATE policy's WITH CHECK only asserted profile_id = auth.uid(),
-- so a user could set org_id to an arbitrary org. Replace it with a policy that
-- pins org_id to the caller's own org on both USING and WITH CHECK.
-- -----------------------------------------------------------------------------
drop policy if exists ics_tokens_owner_update on public.ics_tokens;
create policy ics_tokens_owner_update on public.ics_tokens
  for update to authenticated
  using (profile_id = auth.uid() and org_id = public.my_org_id())
  with check (profile_id = auth.uid() and org_id = public.my_org_id());

-- -----------------------------------------------------------------------------
-- [MEDIUM] Cap the slug length used when minting an invite code, so the code can
-- never exceed the join validator's 80-char limit. We redefine
-- create_org_and_admin with `left(slug, 40)` in the code suffix. Everything else
-- is unchanged from 0002.
-- -----------------------------------------------------------------------------
create or replace function public.create_org_and_admin(
  p_user_id   uuid,
  p_org_name  text,
  p_org_type  text,
  p_display_name text default null
)
returns table (org_id uuid, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id   uuid;
  v_slug     text;
  v_base     text;
  v_suffix   int := 0;
  v_code     text;
begin
  if p_user_id is null then
    raise exception 'user_id required';
  end if;
  if p_org_name is null or length(trim(p_org_name)) = 0 then
    raise exception 'org_name required';
  end if;
  if p_org_type not in ('kita','verein','kirche','betrieb','sonstiges') then
    raise exception 'invalid org_type';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user already belongs to an org';
  end if;

  v_base := public.slugify(p_org_name);
  if v_base is null or length(v_base) = 0 then
    v_base := 'org';
  end if;
  -- Cap the slug to keep both the slug and the derived invite code well within
  -- the join validator's bounds (code = slug + '-' + 6 hex).
  v_base := left(v_base, 40);
  v_base := trim(both '-' from v_base);
  if length(v_base) = 0 then
    v_base := 'org';
  end if;

  v_slug := v_base;
  while exists (select 1 from public.orgs where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base || '-' || v_suffix::text;
  end loop;

  insert into public.orgs (name, slug, org_type)
  values (trim(p_org_name), v_slug, p_org_type)
  returning id into v_org_id;

  insert into public.profiles (id, org_id, role, display_name)
  values (p_user_id, v_org_id, 'admin', p_display_name);

  v_code := v_slug || '-' || encode(public.gen_random_bytes_safe(), 'hex');
  insert into public.invites (org_id, code, role, requires_approval, created_by)
  values (v_org_id, v_code, 'member', true, p_user_id);

  perform public.log_audit(v_org_id, p_user_id, 'org.created', v_org_id,
    jsonb_build_object('slug', v_slug, 'org_type', p_org_type));

  return query select v_org_id, v_code;
end;
$$;

revoke all on function public.create_org_and_admin(uuid, text, text, text) from public;
grant execute on function public.create_org_and_admin(uuid, text, text, text) to service_role;

-- Use more entropy in the random suffix (6 bytes -> 12 hex chars) to harden
-- invite codes against brute force, while staying well under the length cap.
create or replace function public.gen_random_bytes_safe()
returns bytea
language sql
volatile
set search_path = ''
as $$
  select extensions.gen_random_bytes(6)
$$;

-- -----------------------------------------------------------------------------
-- [CRITICAL/HIGH] Server-side onboarding intent binding.
-- The magic-link callback must NOT trust intent/orgName/orgType/invite-code from
-- editable URL query params. Instead, at link-issuance time the server records a
-- pending_onboarding row keyed by (lowercased) email; the callback looks the
-- intent up by the AUTHENTICATED user's email and ignores URL params entirely.
--
-- This table is written/read ONLY by the service role. No RLS policy is granted
-- to authenticated/anon, so with RLS forced it is invisible to end users.
-- -----------------------------------------------------------------------------
create table public.pending_onboarding (
  email       text primary key,           -- lowercased; one pending intent per email
  intent      text not null check (intent in ('org','invite')),
  org_name    text,                        -- for intent='org'
  org_type    text check (org_type is null or org_type in ('kita','verein','kirche','betrieb','sonstiges')),
  invite_code text,                        -- for intent='invite'
  created_at  timestamptz not null default now()
);

alter table public.pending_onboarding enable row level security;
alter table public.pending_onboarding force row level security;
-- No policies => deny-by-default for all non-service roles. Service role bypasses.

-- Upsert a pending org-creation intent for an email.
create or replace function public.set_pending_org(
  p_email    text,
  p_org_name text,
  p_org_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'email required';
  end if;
  if p_org_name is null or length(trim(p_org_name)) = 0 then
    raise exception 'org_name required';
  end if;
  if p_org_type not in ('kita','verein','kirche','betrieb','sonstiges') then
    raise exception 'invalid org_type';
  end if;

  insert into public.pending_onboarding (email, intent, org_name, org_type, invite_code)
  values (lower(trim(p_email)), 'org', trim(p_org_name), p_org_type, null)
  on conflict (email) do update
    set intent = 'org',
        org_name = excluded.org_name,
        org_type = excluded.org_type,
        invite_code = null,
        created_at = now();
end;
$$;

revoke all on function public.set_pending_org(text, text, text) from public;
grant execute on function public.set_pending_org(text, text, text) to service_role;

-- Upsert a pending invite-redemption intent for an email.
create or replace function public.set_pending_invite(
  p_email text,
  p_code  text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'email required';
  end if;
  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'code required';
  end if;

  insert into public.pending_onboarding (email, intent, org_name, org_type, invite_code)
  values (lower(trim(p_email)), 'invite', null, null, trim(p_code))
  on conflict (email) do update
    set intent = 'invite',
        invite_code = excluded.invite_code,
        org_name = null,
        org_type = null,
        created_at = now();
end;
$$;

revoke all on function public.set_pending_invite(text, text) from public;
grant execute on function public.set_pending_invite(text, text) to service_role;

-- Consume (read + delete) the pending intent for an email. Returns one row or none.
create or replace function public.consume_pending_onboarding(p_email text)
returns table (intent text, org_name text, org_type text, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  delete from public.pending_onboarding
  where email = lower(trim(p_email))
  returning pending_onboarding.intent,
            pending_onboarding.org_name,
            pending_onboarding.org_type,
            pending_onboarding.invite_code;
end;
$$;

revoke all on function public.consume_pending_onboarding(text) from public;
grant execute on function public.consume_pending_onboarding(text) to service_role;

-- Housekeeping index for any future purge of stale pending rows (>14 days).
create index pending_onboarding_created_idx on public.pending_onboarding(created_at);
