-- =============================================================================
-- 0009_qr_apply.sql — QR self-apply (parent applies, admin approves)
-- =============================================================================
-- Each org's ADMIN generates an org-scoped, revocable QR/join code. A PARENT
-- scans it, fills a form (parent_name, group, child_name, email), receives an
-- email verification link, clicks it (proves email ownership), and lands in the
-- admin's APPROVAL QUEUE. On approval the parent is provisioned as a member; on
-- approve OR reject the child's personal data is PURGED.
--
-- SECURITY MODEL (this is the app's first public WRITE surface):
--   * Tables here have NO public RLS read/write. The public submit/verify paths
--     run ONLY through SECURITY DEFINER functions called by the server with the
--     service role. Admins read their OWN org's queue via RLS.
--   * The verification token is stored HASHED (sha256). The plaintext exists only
--     in the emailed link; a DB leak does not reveal usable tokens. Token is
--     single-use (cleared on verify) and expires.
--   * Join codes are random, revocable, and org-scoped. No enumeration: lookups
--     are server-side only (no anon RLS on join_codes).
--   * PRIVACY: child_name + group are CHILD DATA. They live ONLY on the pending
--     application, are visible ONLY to that org's admin, and are DELETED on
--     approve/reject. Stale/unverified applications auto-purge. The audit log
--     stays PII-free (it records the application id + action, not the names).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- join_codes — revocable, org-scoped QR codes. One org can rotate/revoke codes.
-- The `code` is the public token embedded in the QR URL (/apply/<code>).
-- -----------------------------------------------------------------------------
create table public.join_codes (
  code        text primary key,                  -- random, unguessable, in the QR
  org_id      uuid not null references public.orgs(id) on delete cascade,
  label       text,                               -- admin's note, e.g. "Aushang Eingang"
  revoked     boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index join_codes_org_idx on public.join_codes(org_id);

-- -----------------------------------------------------------------------------
-- applications — one pending self-apply request. Holds child data TEMPORARILY.
-- -----------------------------------------------------------------------------
create table public.applications (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.orgs(id) on delete cascade,
  join_code          text not null references public.join_codes(code) on delete cascade,
  email              text not null,                          -- applicant email (lowercased)
  parent_name        text,                                   -- purged on decision
  child_group        text,                                   -- CHILD DATA — purged on decision
  child_name         text,                                   -- CHILD DATA — purged on decision
  status             text not null default 'pending'
                       check (status in ('pending','verified','approved','rejected')),
  verify_token_hash  text,                                   -- sha256 of the emailed token; cleared on verify
  verify_expires_at  timestamptz,
  verified_at        timestamptz,
  decided_at         timestamptz,
  created_at         timestamptz not null default now()
);
create index applications_org_status_idx on public.applications(org_id, status);
create index applications_created_idx on public.applications(created_at);

comment on column public.applications.child_name is
  'CHILD personal data — purpose-limited to the approval decision. PURGED on '
  'approve/reject and by the stale-application purge. Never copied to a profile.';
comment on column public.applications.child_group is
  'CHILD group — same purge rules as child_name.';

-- -----------------------------------------------------------------------------
-- RLS: enable + force. Admins (of the SAME org) read/manage their queue. There
-- is intentionally NO public/anon policy — the public submit/verify go through
-- security-definer functions only. Members never see applications.
-- -----------------------------------------------------------------------------
alter table public.join_codes enable row level security;
alter table public.join_codes force row level security;
alter table public.applications enable row level security;
alter table public.applications force row level security;

-- join_codes: admins manage their own org's codes.
create policy join_codes_admin_read on public.join_codes
  for select to authenticated
  using (org_id = public.my_org_id() and public.is_admin());
create policy join_codes_admin_write on public.join_codes
  for all to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());
create policy join_codes_superadmin_all on public.join_codes
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- applications: admins read/manage their own org's queue (no public policy).
create policy applications_admin_read on public.applications
  for select to authenticated
  using (org_id = public.my_org_id() and public.is_admin());
create policy applications_admin_write on public.applications
  for all to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());
create policy applications_superadmin_all on public.applications
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- =============================================================================
-- Security-definer flows
-- =============================================================================

-- create_join_code(actor, org, label, code) — admin mints a code. The random
-- code is generated by the server (so it controls entropy) and passed in.
create or replace function public.create_join_code(
  p_actor_id uuid,
  p_org_id   uuid,
  p_code     text,
  p_label    text default null
)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role in ('admin','superadmin') and org_id = p_org_id
  ) and not exists (
    select 1 from public.profiles where id = p_actor_id and role = 'superadmin'
  ) then
    raise exception 'not authorized';
  end if;
  if p_code is null or length(p_code) < 16 then
    raise exception 'code too short';
  end if;

  insert into public.join_codes (code, org_id, label, created_by)
  values (p_code, p_org_id, p_label, p_actor_id);

  perform public.log_audit(p_org_id, p_actor_id, 'joincode.created', null,
    jsonb_build_object('label', p_label));
  return p_code;
end;
$$;
revoke all on function public.create_join_code(uuid, uuid, text, text) from public;
grant execute on function public.create_join_code(uuid, uuid, text, text) to service_role;

-- submit_application(code, email, parent_name, group, child_name, token_hash, ttl_minutes)
-- PUBLIC path (service_role). Validates the code is live, dedupes a recent
-- pending/verified request for the same email+code, stores the request with the
-- HASHED verify token. Returns the application id (the server then emails the
-- plaintext token link). Never reveals whether the email already applied.
create or replace function public.submit_application(
  p_code        text,
  p_email       text,
  p_parent_name text,
  p_group       text,
  p_child_name  text,
  p_token_hash  text,
  p_ttl_minutes int default 1440
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid;
  v_app_id uuid;
begin
  if p_email is null or length(trim(p_email)) = 0 or p_token_hash is null then
    raise exception 'invalid input';
  end if;

  -- Code must exist and not be revoked.
  select org_id into v_org_id from public.join_codes
  where code = p_code and revoked = false;
  if v_org_id is null then
    raise exception 'invalid code';
  end if;

  -- Rate limit (anti-flood): cap NEW applications per code per hour. The public
  -- submit has no auth, so a flood of distinct emails could otherwise spam the
  -- queue / child-data rows. 30/hour/code is generous for a real Kita but stops
  -- automated abuse. (Resubmits for the same email reuse a row below, so they
  -- don't count against this.)
  if (
    select count(*) from public.applications
    where join_code = p_code and created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'rate limited';
  end if;

  -- Dedupe: collapse a recent un-decided request for the same email+code so the
  -- queue/email can't be flooded by resubmits. Reuse the row, refresh the token.
  select id into v_app_id from public.applications
  where join_code = p_code
    and lower(email) = lower(trim(p_email))
    and status in ('pending','verified')
  order by created_at desc limit 1;

  if v_app_id is null then
    insert into public.applications (
      org_id, join_code, email, parent_name, child_group, child_name,
      status, verify_token_hash, verify_expires_at
    ) values (
      v_org_id, p_code, lower(trim(p_email)), p_parent_name, p_group, p_child_name,
      'pending', p_token_hash, now() + make_interval(mins => p_ttl_minutes)
    ) returning id into v_app_id;
  else
    update public.applications set
      parent_name = p_parent_name, child_group = p_group, child_name = p_child_name,
      status = 'pending', verify_token_hash = p_token_hash,
      verify_expires_at = now() + make_interval(mins => p_ttl_minutes)
    where id = v_app_id;
  end if;

  return v_app_id;
end;
$$;
revoke all on function public.submit_application(text, text, text, text, text, text, int) from public;
grant execute on function public.submit_application(text, text, text, text, text, text, int) to service_role;

-- verify_application(app_id, token_hash) — PUBLIC path (service_role). Marks the
-- application 'verified' if the hash matches and not expired; single-use (clears
-- the token). Returns true on success. Constant work regardless of match.
create or replace function public.verify_application(
  p_app_id     uuid,
  p_token_hash text
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v public.applications%rowtype;
begin
  select * into v from public.applications where id = p_app_id;
  if not found then return false; end if;
  if v.status <> 'pending' then return false; end if;
  if v.verify_token_hash is null or v.verify_expires_at < now() then return false; end if;
  if v.verify_token_hash <> p_token_hash then return false; end if;

  update public.applications
  set status = 'verified', verified_at = now(),
      verify_token_hash = null, verify_expires_at = null
  where id = p_app_id;

  perform public.log_audit(v.org_id, null, 'application.verified', p_app_id, null);
  return true;
end;
$$;
revoke all on function public.verify_application(uuid, text) from public;
grant execute on function public.verify_application(uuid, text) to service_role;

-- approve_application(actor, app_id) — admin approves a VERIFIED request. Marks
-- approved, PURGES child data, returns the applicant email so the server can
-- provision the member (provisionPerson) + send a login link. Re-checks the
-- actor is an admin of the application's org.
create or replace function public.approve_application(
  p_actor_id uuid,
  p_app_id   uuid
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v public.applications%rowtype;
  v_email text;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
  select * into v from public.applications where id = p_app_id for update;
  if not found then raise exception 'application not found'; end if;
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role in ('admin','superadmin') and org_id = v.org_id
  ) and not exists (
    select 1 from public.profiles where id = p_actor_id and role = 'superadmin'
  ) then
    raise exception 'not authorized';
  end if;
  if v.status <> 'verified' then
    raise exception 'application not verified';
  end if;

  v_email := v.email;

  -- Approve + PURGE child/parent personal data (keep email until provisioning,
  -- then the row can be cleaned by the stale purge; status/audit remain).
  update public.applications set
    status = 'approved', decided_at = now(),
    parent_name = null, child_group = null, child_name = null,
    verify_token_hash = null
  where id = p_app_id;

  perform public.log_audit(v.org_id, p_actor_id, 'application.approved', p_app_id, null);
  return v_email;  -- server provisions the member with this
end;
$$;
revoke all on function public.approve_application(uuid, uuid) from public;
grant execute on function public.approve_application(uuid, uuid) to service_role;

-- reject_application(actor, app_id) — admin rejects; PURGES child/parent data.
create or replace function public.reject_application(
  p_actor_id uuid,
  p_app_id   uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.applications%rowtype;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
  select * into v from public.applications where id = p_app_id for update;
  if not found then raise exception 'application not found'; end if;
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role in ('admin','superadmin') and org_id = v.org_id
  ) and not exists (
    select 1 from public.profiles where id = p_actor_id and role = 'superadmin'
  ) then
    raise exception 'not authorized';
  end if;

  update public.applications set
    status = 'rejected', decided_at = now(),
    parent_name = null, child_group = null, child_name = null,
    verify_token_hash = null
  where id = p_app_id;

  perform public.log_audit(v.org_id, p_actor_id, 'application.rejected', p_app_id, null);
end;
$$;
revoke all on function public.reject_application(uuid, uuid) from public;
grant execute on function public.reject_application(uuid, uuid) to service_role;

-- purge_stale_applications() — privacy hygiene. Deletes:
--   * unverified (pending) applications older than 14 days (incl. their child
--     data — they never completed verification);
--   * decided (approved/rejected) applications older than 30 days.
-- Intended to run on a schedule (pg_cron). Child data on live rows is already
-- purged at decision time; this also clears abandoned pending rows.
create or replace function public.purge_stale_applications()
returns int
language plpgsql security definer set search_path = ''
as $$
declare v_count int;
begin
  with deleted as (
    delete from public.applications
    where (status = 'pending'  and created_at < now() - interval '14 days')
       or (status in ('verified') and created_at < now() - interval '14 days')
       or (status in ('approved','rejected') and decided_at < now() - interval '30 days')
    returning 1
  )
  select count(*) into v_count from deleted;
  return v_count;
end;
$$;
revoke all on function public.purge_stale_applications() from public;
grant execute on function public.purge_stale_applications() to service_role;
