-- =============================================================================
-- 0005_operator_model.sql — operator-provisioned, three-role model
-- =============================================================================
-- Supersedes the self-service invite/join onboarding from 0001-0004 with an
-- operator-provisioned model:
--
--   ROLES (three now):
--     superadmin — cross-org operator (you). Creates orgs + first admin,
--                  grants/revokes admin. Lives in the same app with extra rights.
--     admin      — adds/removes MEMBERS in their own org; everything members can do.
--     member     — read-only (feed, calendar). Adds nobody.
--
--   ONBOARDING:
--     * No public signup, no /start, no invite links, no join requests.
--     * superadmin creates an org and its first admin (account + profile created
--       immediately; that admin gets a magic login link).
--     * admin adds a person by email -> account + profile created immediately in
--       the org (status 'invited' until first login) -> magic login link sent.
--     * First superadmin is bootstrapped from the SUPERADMIN_EMAILS env at first
--       login (see ensure_superadmin), with a SQL fallback documented below.
--
-- This migration: alters the role CHECK, drops obsolete tables/functions/policies,
-- redefines helpers, adds membership_status to profiles, and adds the new
-- security-definer provisioning flows.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Drop obsolete onboarding objects (invites, join_requests, pending_onboarding)
-- and their dependent functions/policies. CASCADE handles dependent policies.
-- -----------------------------------------------------------------------------
drop function if exists public.redeem_invite(uuid, text, text);
drop function if exists public.request_join(text, text);
drop function if exists public.approve_join_request(uuid, uuid);
drop function if exists public.reject_join_request(uuid, uuid);
drop function if exists public.redeem_approved_join(uuid, text, text);
drop function if exists public.set_pending_org(text, text, text);
drop function if exists public.set_pending_invite(text, text);
drop function if exists public.consume_pending_onboarding(text);
drop function if exists public.create_org_and_admin(uuid, text, text, text);

drop table if exists public.pending_onboarding cascade;
drop table if exists public.join_requests cascade;
drop table if exists public.invites cascade;

-- -----------------------------------------------------------------------------
-- profiles: allow the new 'superadmin' role and add a membership_status so the
-- member list can show invited-but-not-yet-logged-in people.
-- -----------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('superadmin','admin','member'));

alter table public.profiles
  add column if not exists membership_status text not null default 'active'
  check (membership_status in ('invited','active'));

-- A superadmin's org_id is still set (they are created within a "home" org or a
-- dedicated operator org), but their reach is cross-org via is_superadmin().

-- =============================================================================
-- Helper functions (redefined for three roles)
-- =============================================================================

-- Unchanged: caller's own org.
create or replace function public.my_org_id()
returns uuid
language sql stable security definer set search_path = ''
as $$ select org_id from public.profiles where id = auth.uid() $$;

-- True if caller is a superadmin (cross-org operator).
create or replace function public.is_superadmin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  )
$$;

-- True if caller can act as an admin: either an org admin OR a superadmin.
-- Superadmins inherit admin capabilities everywhere (RLS still scopes rows by
-- org via separate superadmin policies; this is used where "admin-or-above" is
-- the gate).
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','superadmin')
  )
$$;

revoke all on function public.my_org_id() from public;
revoke all on function public.is_superadmin() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.my_org_id() to authenticated;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- =============================================================================
-- Provisioning flows (security definer, service_role only)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ensure_superadmin(user_id, email) — bootstrap the first superadmin(s).
-- Called by the server at login when the user's email is in SUPERADMIN_EMAILS.
-- If the user has NO profile yet, create a dedicated operator org + superadmin
-- profile. If they already have a profile, elevate it to superadmin. Idempotent.
-- The env allowlist is checked SERVER-SIDE before calling this; the function
-- itself trusts the server (service_role) to have validated membership.
-- -----------------------------------------------------------------------------
create or replace function public.ensure_superadmin(
  p_user_id uuid,
  p_email   text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_org_id  uuid;
  v_slug    text;
  v_suffix  int := 0;
  v_base    text := 'operator';
begin
  if p_user_id is null then
    raise exception 'user_id required';
  end if;

  select * into v_profile from public.profiles where id = p_user_id;

  if found then
    if v_profile.role <> 'superadmin' then
      update public.profiles
        set role = 'superadmin', membership_status = 'active'
        where id = p_user_id;
      perform public.log_audit(v_profile.org_id, p_user_id, 'superadmin.elevated', p_user_id, null);
    end if;
    return v_profile.org_id;
  end if;

  -- No profile: create a dedicated operator org to anchor the superadmin.
  v_slug := v_base;
  while exists (select 1 from public.orgs where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base || '-' || v_suffix::text;
  end loop;

  insert into public.orgs (name, slug, org_type)
  values ('Operator', v_slug, 'sonstiges')
  returning id into v_org_id;

  insert into public.profiles (id, org_id, role, membership_status, display_name)
  values (p_user_id, v_org_id, 'superadmin', 'active', null);

  perform public.log_audit(v_org_id, p_user_id, 'superadmin.bootstrapped', p_user_id,
    jsonb_build_object('email', lower(trim(coalesce(p_email, '')))));

  return v_org_id;
end;
$$;

revoke all on function public.ensure_superadmin(uuid, text) from public;
grant execute on function public.ensure_superadmin(uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- create_org(actor_id, org_name, org_type) — superadmin creates an org shell.
-- Returns the new org id. Does NOT create the admin; use add_person to add the
-- first admin afterwards (keeps account creation in one place).
-- -----------------------------------------------------------------------------
create or replace function public.create_org(
  p_actor_id uuid,
  p_org_name text,
  p_org_type text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid;
  v_base   text;
  v_slug   text;
  v_suffix int := 0;
begin
  -- Authorization: actor must be a superadmin.
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'superadmin') then
    raise exception 'not authorized';
  end if;
  if p_org_name is null or length(trim(p_org_name)) = 0 then
    raise exception 'org_name required';
  end if;
  if p_org_type not in ('kita','verein','kirche','betrieb','sonstiges') then
    raise exception 'invalid org_type';
  end if;

  v_base := left(coalesce(nullif(public.slugify(p_org_name), ''), 'org'), 40);
  v_base := trim(both '-' from v_base);
  if length(v_base) = 0 then v_base := 'org'; end if;

  v_slug := v_base;
  while exists (select 1 from public.orgs where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base || '-' || v_suffix::text;
  end loop;

  insert into public.orgs (name, slug, org_type)
  values (trim(p_org_name), v_slug, p_org_type)
  returning id into v_org_id;

  perform public.log_audit(v_org_id, p_actor_id, 'org.created', v_org_id,
    jsonb_build_object('slug', v_slug, 'org_type', p_org_type));

  return v_org_id;
end;
$$;

revoke all on function public.create_org(uuid, text, text) from public;
grant execute on function public.create_org(uuid, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- add_person(actor_id, target_user_id, target_org_id, email, role) —
-- create a profile for an already-created auth user, in target_org, with the
-- given role. The auth user is created by the server (admin API) just before
-- this call; this function only writes the profile + audit, atomically and with
-- authorization checks.
--
-- Authorization rules:
--   * superadmin: may add anyone (member or admin) to ANY org.
--   * admin: may add MEMBERS to their OWN org only (never admins, never other orgs).
--   * member: cannot add anyone.
-- Created profiles start membership_status='invited' (flips to 'active' on first
-- login). One user = one profile (the PK enforces this).
-- -----------------------------------------------------------------------------
create or replace function public.add_person(
  p_actor_id      uuid,
  p_target_user_id uuid,
  p_target_org_id  uuid,
  p_role          text,
  p_display_name  text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
begin
  if p_target_user_id is null or p_target_org_id is null then
    raise exception 'target user and org required';
  end if;
  if p_role not in ('admin','member') then
    raise exception 'invalid role';   -- superadmins are made via grant_admin/ensure_superadmin only
  end if;

  select * into v_actor from public.profiles where id = p_actor_id;
  if not found then
    raise exception 'actor has no profile';
  end if;

  -- Authorization.
  if v_actor.role = 'superadmin' then
    null; -- may add anyone, anywhere
  elsif v_actor.role = 'admin' then
    if p_target_org_id <> v_actor.org_id then
      raise exception 'not authorized: cross-org';
    end if;
    if p_role <> 'member' then
      raise exception 'not authorized: admins may add members only';
    end if;
  else
    raise exception 'not authorized';
  end if;

  if exists (select 1 from public.profiles where id = p_target_user_id) then
    raise exception 'user already belongs to an org';
  end if;

  insert into public.profiles (id, org_id, role, membership_status, display_name)
  values (p_target_user_id, p_target_org_id, p_role, 'invited', p_display_name);

  perform public.log_audit(p_target_org_id, p_actor_id, 'person.added', p_target_user_id,
    jsonb_build_object('role', p_role));
end;
$$;

revoke all on function public.add_person(uuid, uuid, uuid, text, text) from public;
grant execute on function public.add_person(uuid, uuid, uuid, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- remove_person(actor_id, target_user_id) — remove a person from an org.
--   * superadmin: may remove anyone in any org (except themselves via this path).
--   * admin: may remove MEMBERS in their own org (never admins/superadmins).
-- Deletes the auth user (profile cascades). Refuses to remove the last admin of
-- an org to avoid orphaning it.
-- -----------------------------------------------------------------------------
create or replace function public.remove_person(
  p_actor_id      uuid,
  p_target_user_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor  public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_admin_count int;
begin
  select * into v_actor from public.profiles where id = p_actor_id;
  if not found then raise exception 'actor has no profile'; end if;

  select * into v_target from public.profiles where id = p_target_user_id;
  if not found then return; end if;  -- idempotent

  if p_actor_id = p_target_user_id then
    raise exception 'cannot remove yourself here';
  end if;

  -- Authorization.
  if v_actor.role = 'superadmin' then
    null; -- may remove anyone
  elsif v_actor.role = 'admin' then
    if v_target.org_id <> v_actor.org_id then
      raise exception 'not authorized: cross-org';
    end if;
    if v_target.role <> 'member' then
      raise exception 'not authorized: admins may remove members only';
    end if;
  else
    raise exception 'not authorized';
  end if;

  -- Never orphan an org by removing its last admin.
  if v_target.role = 'admin' then
    select count(*) into v_admin_count
    from public.profiles where org_id = v_target.org_id and role = 'admin';
    if v_admin_count <= 1 then
      raise exception 'cannot remove the last admin of an org';
    end if;
  end if;

  perform public.log_audit(v_target.org_id, p_actor_id, 'person.removed', p_target_user_id,
    jsonb_build_object('role', v_target.role));

  delete from auth.users where id = p_target_user_id;  -- profile cascades
end;
$$;

revoke all on function public.remove_person(uuid, uuid) from public;
grant execute on function public.remove_person(uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- set_admin(actor_id, target_user_id, make_admin) — superadmin grants/revokes
-- admin rights within the target's org. Only superadmins may call. Revoking
-- refuses to drop the last admin.
-- -----------------------------------------------------------------------------
create or replace function public.set_admin(
  p_actor_id       uuid,
  p_target_user_id uuid,
  p_make_admin     boolean
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_target public.profiles%rowtype;
  v_admin_count int;
begin
  if not exists (select 1 from public.profiles where id = p_actor_id and role = 'superadmin') then
    raise exception 'not authorized';
  end if;

  select * into v_target from public.profiles where id = p_target_user_id;
  if not found then raise exception 'target not found'; end if;
  if v_target.role = 'superadmin' then
    raise exception 'cannot change a superadmin via set_admin';
  end if;

  if p_make_admin then
    if v_target.role <> 'admin' then
      update public.profiles set role = 'admin' where id = p_target_user_id;
      perform public.log_audit(v_target.org_id, p_actor_id, 'admin.granted', p_target_user_id, null);
    end if;
  else
    if v_target.role = 'admin' then
      select count(*) into v_admin_count
      from public.profiles where org_id = v_target.org_id and role = 'admin';
      if v_admin_count <= 1 then
        raise exception 'cannot revoke the last admin of an org';
      end if;
      update public.profiles set role = 'member' where id = p_target_user_id;
      perform public.log_audit(v_target.org_id, p_actor_id, 'admin.revoked', p_target_user_id, null);
    end if;
  end if;
end;
$$;

revoke all on function public.set_admin(uuid, uuid, boolean) from public;
grant execute on function public.set_admin(uuid, uuid, boolean) to service_role;

-- -----------------------------------------------------------------------------
-- activate_profile(user_id) — flip membership_status 'invited' -> 'active' on
-- first successful login. Called by the server after auth.
-- -----------------------------------------------------------------------------
create or replace function public.activate_profile(p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles
    set membership_status = 'active'
    where id = p_user_id and membership_status = 'invited';
end;
$$;

revoke all on function public.activate_profile(uuid) from public;
grant execute on function public.activate_profile(uuid) to service_role;
