-- =============================================================================
-- 0015_groups_and_roles.sql — org groups + admin-scoped role management
-- =============================================================================
-- Two additions:
--   1) GROUPS: each org has a managed list of groups (e.g. "Kita 1", "Kita 2").
--      Admins create/rename/delete them; people are assigned to a group. (A
--      group is an attribute of people within ONE org — not an org type.)
--   2) ADMIN role management: org admins can promote/demote their OWN org's
--      members (member <-> admin). Previously only superadmins could (set_admin).
--      Superadmin status is still never grantable here.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: is the actor an admin (or superadmin) of the given org? Defined first
-- because the flows below call it.
-- -----------------------------------------------------------------------------
create or replace function public.actor_is_admin_of(p_actor_id uuid, p_org_id uuid)
returns boolean
language sql security definer set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = p_actor_id and role in ('admin','superadmin') and org_id = p_org_id
  ) or exists (
    select 1 from public.profiles where id = p_actor_id and role = 'superadmin'
  )
$$;
revoke all on function public.actor_is_admin_of(uuid, uuid) from public;
grant execute on function public.actor_is_admin_of(uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- groups — org-scoped, admin-managed.
-- -----------------------------------------------------------------------------
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  created_at  timestamptz not null default now(),
  unique (org_id, name)
);
create index groups_org_idx on public.groups(org_id);

-- profiles gain an optional group membership (set null if the group is deleted).
alter table public.profiles
  add column if not exists group_id uuid references public.groups(id) on delete set null;

alter table public.groups enable row level security;
alter table public.groups force row level security;

-- Everyone in the org can READ the group list (members see their own group name,
-- the feed can show group labels). Admins manage them.
create policy groups_member_read on public.groups
  for select to authenticated
  using (org_id = public.my_org_id());

create policy groups_admin_write on public.groups
  for all to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

create policy groups_superadmin_all on public.groups
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

grant select on public.groups to authenticated;
-- Re-grant the new profiles column to authenticated (0004 used a fixed-list
-- grant for posts, but profiles was never column-revoked, so a table-level grant
-- already covers group_id; this is a no-op safeguard).

-- -----------------------------------------------------------------------------
-- create_group / rename_group / delete_group — admin-managed (service role).
-- -----------------------------------------------------------------------------
create or replace function public.create_group(
  p_actor_id uuid, p_org_id uuid, p_name text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
  if not public.actor_is_admin_of(p_actor_id, p_org_id) then
    raise exception 'not authorized';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name required';
  end if;
  insert into public.groups (org_id, name) values (p_org_id, trim(p_name))
  returning id into v_id;
  perform public.log_audit(p_org_id, p_actor_id, 'group.created', v_id,
    jsonb_build_object('name', trim(p_name)));
  return v_id;
end;
$$;
revoke all on function public.create_group(uuid, uuid, text) from public;
grant execute on function public.create_group(uuid, uuid, text) to service_role;

create or replace function public.rename_group(
  p_actor_id uuid, p_group_id uuid, p_name text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_org uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
  select org_id into v_org from public.groups where id = p_group_id;
  if v_org is null then raise exception 'group not found'; end if;
  if not public.actor_is_admin_of(p_actor_id, v_org) then
    raise exception 'not authorized';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name required';
  end if;
  update public.groups set name = trim(p_name) where id = p_group_id;
  perform public.log_audit(v_org, p_actor_id, 'group.renamed', p_group_id, null);
end;
$$;
revoke all on function public.rename_group(uuid, uuid, text) from public;
grant execute on function public.rename_group(uuid, uuid, text) to service_role;

create or replace function public.delete_group(
  p_actor_id uuid, p_group_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_org uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
  select org_id into v_org from public.groups where id = p_group_id;
  if v_org is null then return; end if;  -- idempotent
  if not public.actor_is_admin_of(p_actor_id, v_org) then
    raise exception 'not authorized';
  end if;
  delete from public.groups where id = p_group_id;  -- profiles.group_id -> null
  perform public.log_audit(v_org, p_actor_id, 'group.deleted', p_group_id, null);
end;
$$;
revoke all on function public.delete_group(uuid, uuid) from public;
grant execute on function public.delete_group(uuid, uuid) to service_role;

-- assign_group(actor, target_user, group|null) — admin assigns a person in their
-- org to a group (or clears it). Group must belong to the same org.
create or replace function public.assign_group(
  p_actor_id uuid, p_target_user_id uuid, p_group_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_org uuid; v_target_org uuid; v_group_org uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
  select org_id into v_target_org from public.profiles where id = p_target_user_id;
  if v_target_org is null then raise exception 'target not found'; end if;
  if not public.actor_is_admin_of(p_actor_id, v_target_org) then
    raise exception 'not authorized';
  end if;
  if p_group_id is not null then
    select org_id into v_group_org from public.groups where id = p_group_id;
    if v_group_org is null or v_group_org <> v_target_org then
      raise exception 'group not in this org';
    end if;
  end if;
  update public.profiles set group_id = p_group_id where id = p_target_user_id;
  perform public.log_audit(v_target_org, p_actor_id, 'person.group_set', p_target_user_id,
    jsonb_build_object('group_id', p_group_id));
end;
$$;
revoke all on function public.assign_group(uuid, uuid, uuid) from public;
grant execute on function public.assign_group(uuid, uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- set_member_role(actor, target, make_admin) — an ORG ADMIN promotes/demotes a
-- member in their OWN org (member <-> admin). Cannot touch superadmins, cannot
-- demote the last admin, cannot change themselves. (Superadmins still use the
-- broader set_admin from 0005/0007.)
-- -----------------------------------------------------------------------------
create or replace function public.set_member_role(
  p_actor_id uuid, p_target_user_id uuid, p_make_admin boolean
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_admin_count int;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
  select * into v_actor from public.profiles where id = p_actor_id;
  if not found or v_actor.role not in ('admin','superadmin') then
    raise exception 'not authorized';
  end if;
  select * into v_target from public.profiles where id = p_target_user_id;
  if not found then raise exception 'target not found'; end if;

  -- An org admin may only act within their own org; superadmins anywhere.
  if v_actor.role = 'admin' and v_target.org_id <> v_actor.org_id then
    raise exception 'not authorized: cross-org';
  end if;
  if v_target.role = 'superadmin' then
    raise exception 'cannot change a superadmin';
  end if;
  if p_actor_id = p_target_user_id then
    raise exception 'cannot change your own role';
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
        raise exception 'cannot demote the last admin of an org';
      end if;
      update public.profiles set role = 'member' where id = p_target_user_id;
      perform public.log_audit(v_target.org_id, p_actor_id, 'admin.revoked', p_target_user_id, null);
    end if;
  end if;
end;
$$;
revoke all on function public.set_member_role(uuid, uuid, boolean) from public;
grant execute on function public.set_member_role(uuid, uuid, boolean) to service_role;
