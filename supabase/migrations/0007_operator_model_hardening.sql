-- =============================================================================
-- 0007_operator_model_hardening.sql — fixes from the operator-model review
-- =============================================================================
-- Addresses confirmed findings from the three-role refactor review:
--   [HIGH] Drop the orphaned delete_user_account() — it still contained the
--          legacy "last admin leaving => delete the whole org" cascade, was
--          unaware of the superadmin role, and is a service-role-callable
--          tenant-nuking footgun the new model abandoned (deletion is via
--          remove_person, which refuses to remove the last admin).
--   [LOW]  Pin membership_status in profiles_update_self so a member cannot
--          self-forge their invited/active status from the anon client.
--   [INFO] Add an auth.uid() backstop inside the definer provisioning RPCs so an
--          accidental future grant-to-authenticated cannot become self-elevation
--          (defense in depth; today they are service_role-only).
--   [INFO] Add a superadmin-only delete_org() so a decommissioned org (and its
--          data, for GDPR erasure) can be removed deliberately — replacing the
--          dangerous implicit deletion that delete_user_account used to do.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- [HIGH] Remove the org-nuking footgun.
-- -----------------------------------------------------------------------------
drop function if exists public.delete_user_account(uuid);

-- -----------------------------------------------------------------------------
-- [LOW] Pin membership_status (and re-affirm role/org_id) in the self-update
-- policy. A member may still edit display_name / email_digest_opt_in, but cannot
-- change role, org_id, or membership_status.
-- -----------------------------------------------------------------------------
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and org_id = (select p.org_id from public.profiles p where p.id = auth.uid())
    and membership_status = (
      select p.membership_status from public.profiles p where p.id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- [INFO] auth.uid() backstop in the provisioning RPCs.
-- These run as service_role today (no user JWT, so auth.uid() is NULL). The
-- guard below asserts: EITHER there is no user context (pure service-role call,
-- auth.uid() IS NULL) OR the caller's JWT identity matches the claimed actor.
-- This makes an accidental future `grant execute ... to authenticated` non-
-- exploitable for self-elevation, because a logged-in user could no longer pass
-- someone else's id as p_actor_id.
--
-- We redefine each function to add the guard at the top; bodies otherwise match
-- 0005. (create_org / add_person / remove_person / set_admin.) ensure_superadmin
-- is intentionally NOT guarded this way: it legitimately acts before the target
-- has any session, and is service_role-only with the email allowlist checked by
-- the server.
-- -----------------------------------------------------------------------------

create or replace function public.create_org(
  p_actor_id uuid, p_org_name text, p_org_type text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid; v_base text; v_slug text; v_suffix int := 0;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
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

create or replace function public.add_person(
  p_actor_id uuid, p_target_user_id uuid, p_target_org_id uuid,
  p_role text, p_display_name text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_actor public.profiles%rowtype;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
  if p_target_user_id is null or p_target_org_id is null then
    raise exception 'target user and org required';
  end if;
  if p_role not in ('admin','member') then
    raise exception 'invalid role';
  end if;

  select * into v_actor from public.profiles where id = p_actor_id;
  if not found then raise exception 'actor has no profile'; end if;

  if v_actor.role = 'superadmin' then
    null;
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

create or replace function public.remove_person(
  p_actor_id uuid, p_target_user_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype; v_target public.profiles%rowtype; v_admin_count int;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;

  select * into v_actor from public.profiles where id = p_actor_id;
  if not found then raise exception 'actor has no profile'; end if;
  select * into v_target from public.profiles where id = p_target_user_id;
  if not found then return; end if;

  if p_actor_id = p_target_user_id then
    raise exception 'cannot remove yourself here';
  end if;

  if v_actor.role = 'superadmin' then
    null;
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

  if v_target.role = 'admin' then
    select count(*) into v_admin_count
    from public.profiles where org_id = v_target.org_id and role = 'admin';
    if v_admin_count <= 1 then
      raise exception 'cannot remove the last admin of an org';
    end if;
  end if;

  perform public.log_audit(v_target.org_id, p_actor_id, 'person.removed', p_target_user_id,
    jsonb_build_object('role', v_target.role));
  delete from auth.users where id = p_target_user_id;
end;
$$;
revoke all on function public.remove_person(uuid, uuid) from public;
grant execute on function public.remove_person(uuid, uuid) to service_role;

create or replace function public.set_admin(
  p_actor_id uuid, p_target_user_id uuid, p_make_admin boolean
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_target public.profiles%rowtype; v_admin_count int;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
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
-- [INFO] delete_org — deliberate, superadmin-only org teardown (GDPR erasure).
-- Replaces the implicit org deletion the old delete_user_account did. Refuses to
-- delete an Operator anchor org or the actor's own org. Cascades remove the
-- org's profiles/posts/events/audit rows (orgs ON DELETE CASCADE), and the
-- profile cascade does NOT delete auth.users — so we also remove the org's auth
-- users explicitly to fully erase accounts.
-- -----------------------------------------------------------------------------
create or replace function public.delete_org(
  p_actor_id uuid, p_org_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_actor public.profiles%rowtype;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
  select * into v_actor from public.profiles where id = p_actor_id;
  if not found or v_actor.role <> 'superadmin' then
    raise exception 'not authorized';
  end if;
  if p_org_id = v_actor.org_id then
    raise exception 'cannot delete your own operator org';
  end if;

  perform public.log_audit(p_org_id, p_actor_id, 'org.deleted', p_org_id, null);

  -- Erase the org's auth users (their profiles cascade-delete with the org).
  delete from auth.users u
  using public.profiles p
  where p.id = u.id and p.org_id = p_org_id;

  -- Remove the org (cascades posts/events/audit/profiles/ics_tokens).
  delete from public.orgs where id = p_org_id;
end;
$$;
revoke all on function public.delete_org(uuid, uuid) from public;
grant execute on function public.delete_org(uuid, uuid) to service_role;
