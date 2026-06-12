-- =============================================================================
-- 0002_functions.sql — helper + security-definer functions
-- =============================================================================
-- Two groups:
--   (A) STABLE helper fns used inside RLS policies: my_org_id(), is_admin().
--   (B) SECURITY DEFINER flows that are the ONLY writers of profiles.role and
--       the ONLY creators of orgs/profiles: create_org_and_admin(),
--       redeem_invite(), approve_join_request(), reject_join_request(),
--       delete_user_account(), log_audit().
--
-- SECURITY DEFINER hardening rules applied to EVERY definer function here:
--   * `set search_path = ''` — fully-qualify every object (public.x, auth.x).
--     Prevents search_path-injection privilege escalation.
--   * Validate all inputs; fail closed.
--   * These run with the privileges of the function owner (postgres), so they
--     bypass RLS by design — that is the whole point. Keep their surface tiny.
--
-- The server (Next.js) calls the definer flows via the SERVICE ROLE only, after
-- it has done its own auth/role checks. Clients never call them directly.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- (A) RLS helper functions
-- -----------------------------------------------------------------------------

-- Current user's org. STABLE + security definer so it can read profiles even
-- under the caller's RLS (it only ever returns the caller's own org_id).
create or replace function public.my_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

-- Is the current user an admin (of their own org)?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

revoke all on function public.my_org_id() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.my_org_id() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- (B0) audit logging — append-only, callable by definer flows
-- -----------------------------------------------------------------------------
create or replace function public.log_audit(
  p_org_id   uuid,
  p_actor_id uuid,
  p_action   text,
  p_target_id uuid default null,
  p_meta     jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (org_id, actor_id, action, target_id, meta)
  values (p_org_id, p_actor_id, p_action, p_target_id, p_meta);
end;
$$;

revoke all on function public.log_audit(uuid, uuid, text, uuid, jsonb) from public;
-- Only the service role (server) and other definer fns invoke this.
grant execute on function public.log_audit(uuid, uuid, text, uuid, jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- (B1) slug helper — deterministic, collision-resistant org slug
-- -----------------------------------------------------------------------------
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  -- lowercase, strip german umlauts, keep [a-z0-9-], collapse dashes
  select trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(
          translate(p_text,
            'äöüßÄÖÜ',
            'aousAOU')   -- ß -> s here (position 4)
        ),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  )
$$;

-- -----------------------------------------------------------------------------
-- (B2) create_org_and_admin — self-service org creation (/start)
-- -----------------------------------------------------------------------------
-- Called by the server (service role) AFTER the user has authenticated via
-- magic link. Creates the org, promotes the caller to admin, mints a first
-- invite code, and audit-logs. Idempotent-ish: if the caller already has a
-- profile, it errors (one user = one org in v1).
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
  -- Input validation (fail closed).
  if p_user_id is null then
    raise exception 'user_id required';
  end if;
  if p_org_name is null or length(trim(p_org_name)) = 0 then
    raise exception 'org_name required';
  end if;
  if p_org_type not in ('kita','verein','kirche','betrieb','sonstiges') then
    raise exception 'invalid org_type';
  end if;

  -- One user belongs to exactly one org in v1.
  if exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user already belongs to an org';
  end if;

  -- Unique slug.
  v_base := public.slugify(p_org_name);
  if v_base is null or length(v_base) = 0 then
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

  -- Promote caller to admin of the new org.
  insert into public.profiles (id, org_id, role, display_name)
  values (p_user_id, v_org_id, 'admin', p_display_name);

  -- Mint a first shareable invite code: <slug>-<6 hex>.
  v_code := v_slug || '-' || encode(public.gen_random_bytes_safe(), 'hex');
  insert into public.invites (org_id, code, role, requires_approval, created_by)
  values (v_org_id, v_code, 'member', true, p_user_id);

  perform public.log_audit(v_org_id, p_user_id, 'org.created', v_org_id,
    jsonb_build_object('slug', v_slug, 'org_type', p_org_type));

  return query select v_org_id, v_code;
end;
$$;

-- Small wrapper so we don't depend on pgcrypto's schema location under
-- search_path=''. gen_random_bytes lives in the `extensions` schema on Supabase.
create or replace function public.gen_random_bytes_safe()
returns bytea
language sql
volatile
set search_path = ''
as $$
  select extensions.gen_random_bytes(3)
$$;

revoke all on function public.create_org_and_admin(uuid, text, text, text) from public;
grant execute on function public.create_org_and_admin(uuid, text, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- (B3) redeem_invite — turn a valid invite code into a member/admin profile
-- -----------------------------------------------------------------------------
-- Called by the server (service role) AFTER the joining user has authenticated
-- via magic link, when the invite does NOT require approval. Atomically checks
-- validity, increments use_count, and creates the profile with the invite's
-- role. Returns the org_id. All-or-nothing.
create or replace function public.redeem_invite(
  p_user_id      uuid,
  p_code         text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite   public.invites%rowtype;
  v_org_id   uuid;
begin
  if p_user_id is null or p_code is null then
    raise exception 'user_id and code required';
  end if;

  -- Lock the invite row to make the use_count check + increment atomic.
  select * into v_invite
  from public.invites
  where code = p_code
  for update;

  if not found then
    raise exception 'invalid invite code';
  end if;
  if v_invite.requires_approval then
    -- Wrong entrypoint: approval-required invites go through request/approve.
    raise exception 'invite requires approval';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'invite expired';
  end if;
  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    raise exception 'invite exhausted';
  end if;

  -- One user = one org.
  if exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user already belongs to an org';
  end if;

  insert into public.profiles (id, org_id, role, display_name)
  values (p_user_id, v_invite.org_id, v_invite.role, p_display_name);

  update public.invites
  set use_count = use_count + 1
  where id = v_invite.id;

  v_org_id := v_invite.org_id;

  perform public.log_audit(v_org_id, p_user_id, 'invite.redeemed', v_invite.id,
    jsonb_build_object('role', v_invite.role));

  return v_org_id;
end;
$$;

revoke all on function public.redeem_invite(uuid, text, text) from public;
grant execute on function public.redeem_invite(uuid, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- (B4) request_join — record a pending join request (approval-required invites)
-- -----------------------------------------------------------------------------
-- Called by the server when a user submits their email against an approval-
-- required invite, BEFORE they authenticate. No profile is created here.
create or replace function public.request_join(
  p_code  text,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invites%rowtype;
  v_req_id uuid;
begin
  if p_code is null or p_email is null or length(trim(p_email)) = 0 then
    raise exception 'code and email required';
  end if;

  select * into v_invite from public.invites where code = p_code;
  if not found then
    raise exception 'invalid invite code';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'invite expired';
  end if;
  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    raise exception 'invite exhausted';
  end if;

  -- Collapse duplicate pending requests for the same email+invite.
  select id into v_req_id
  from public.join_requests
  where invite_id = v_invite.id
    and lower(email) = lower(trim(p_email))
    and status = 'pending'
  limit 1;

  if v_req_id is null then
    insert into public.join_requests (org_id, invite_id, email, status)
    values (v_invite.org_id, v_invite.id, lower(trim(p_email)), 'pending')
    returning id into v_req_id;

    perform public.log_audit(v_invite.org_id, null, 'join.requested', v_req_id,
      jsonb_build_object('invite_id', v_invite.id));
  end if;

  return v_req_id;
end;
$$;

revoke all on function public.request_join(text, text) from public;
grant execute on function public.request_join(text, text) to service_role;

-- -----------------------------------------------------------------------------
-- (B5) approve_join_request — admin approves, profile is created on first login
-- -----------------------------------------------------------------------------
-- The admin (server-side, after role check) approves a pending request. We mark
-- it approved and audit-log. The actual profile creation happens via
-- redeem_approved_join() when that user clicks their magic link, because we need
-- their auth.users id, which only exists after they authenticate.
create or replace function public.approve_join_request(
  p_actor_id uuid,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.join_requests%rowtype;
begin
  select * into v_req from public.join_requests where id = p_request_id for update;
  if not found then
    raise exception 'join request not found';
  end if;

  -- Actor must be an admin of the SAME org as the request.
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'admin' and org_id = v_req.org_id
  ) then
    raise exception 'not authorized';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'request not pending';
  end if;

  update public.join_requests set status = 'approved' where id = p_request_id;

  perform public.log_audit(v_req.org_id, p_actor_id, 'join.approved', p_request_id,
    jsonb_build_object('email', v_req.email));
end;
$$;

revoke all on function public.approve_join_request(uuid, uuid) from public;
grant execute on function public.approve_join_request(uuid, uuid) to service_role;

create or replace function public.reject_join_request(
  p_actor_id uuid,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.join_requests%rowtype;
begin
  select * into v_req from public.join_requests where id = p_request_id for update;
  if not found then
    raise exception 'join request not found';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'admin' and org_id = v_req.org_id
  ) then
    raise exception 'not authorized';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request not pending';
  end if;

  update public.join_requests set status = 'rejected' where id = p_request_id;
  perform public.log_audit(v_req.org_id, p_actor_id, 'join.rejected', p_request_id, null);
end;
$$;

revoke all on function public.reject_join_request(uuid, uuid) from public;
grant execute on function public.reject_join_request(uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- (B6) redeem_approved_join — create the profile for an approved requester
-- -----------------------------------------------------------------------------
-- Called by the server (service role) after the approved user authenticates via
-- magic link. Matches on email + approved status, creates the profile with the
-- invite's role, increments the invite use_count.
create or replace function public.redeem_approved_join(
  p_user_id      uuid,
  p_email        text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req    public.join_requests%rowtype;
  v_invite public.invites%rowtype;
begin
  if p_user_id is null or p_email is null then
    raise exception 'user_id and email required';
  end if;

  -- Find the most recent approved request for this email.
  select * into v_req
  from public.join_requests
  where lower(email) = lower(trim(p_email)) and status = 'approved'
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'no approved join request for this email';
  end if;

  if exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user already belongs to an org';
  end if;

  select * into v_invite from public.invites where id = v_req.invite_id for update;
  if not found then
    raise exception 'invite no longer exists';
  end if;
  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    raise exception 'invite exhausted';
  end if;

  insert into public.profiles (id, org_id, role, display_name)
  values (p_user_id, v_req.org_id, v_invite.role, p_display_name);

  update public.invites set use_count = use_count + 1 where id = v_invite.id;

  perform public.log_audit(v_req.org_id, p_user_id, 'invite.redeemed', v_invite.id,
    jsonb_build_object('via', 'approval', 'role', v_invite.role));

  return v_req.org_id;
end;
$$;

revoke all on function public.redeem_approved_join(uuid, text, text) from public;
grant execute on function public.redeem_approved_join(uuid, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- (B7) delete_user_account — GDPR cascade (Brief §12)
-- -----------------------------------------------------------------------------
-- Deletes the auth user; ON DELETE CASCADE from profiles removes their data.
-- If the user is the LAST admin of an org, the whole org is deleted (cascades
-- to posts/events/etc). Audit-logged before deletion.
create or replace function public.delete_user_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_admin_count int;
begin
  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    -- Nothing to delete (already gone). Idempotent.
    return;
  end if;

  if v_profile.role = 'admin' then
    select count(*) into v_admin_count
    from public.profiles
    where org_id = v_profile.org_id and role = 'admin';

    perform public.log_audit(v_profile.org_id, p_user_id, 'user.deleted', p_user_id,
      jsonb_build_object('was_admin', true, 'admin_count', v_admin_count));

    if v_admin_count <= 1 then
      -- Last admin leaving => delete the org (cascades everything).
      delete from public.orgs where id = v_profile.org_id;
    end if;
  else
    perform public.log_audit(v_profile.org_id, p_user_id, 'user.deleted', p_user_id,
      jsonb_build_object('was_admin', false));
  end if;

  -- Remove the auth user; profiles row cascades from auth.users.
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.delete_user_account(uuid) from public;
grant execute on function public.delete_user_account(uuid) to service_role;
