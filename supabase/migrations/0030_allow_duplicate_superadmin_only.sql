-- =============================================================================
-- 0030_allow_duplicate_superadmin_only.sql — restrict "upload anyway" to operator
-- =============================================================================
-- 0029 let ANY admin override the exact-photo dedup ("upload anyway"). We now
-- restrict that override to the OPERATOR (superadmin) only — a normal org admin
-- stays hard-blocked on a duplicate. Capturing a NEW photo is unchanged for all
-- admins; only the p_allow_duplicate=true branch now additionally requires the
-- actor to be a superadmin.
--
-- This is the AUTHORITATIVE check (the server action + UI also gate it, but the
-- RPC is the real boundary: a normal admin who forced p_allow_duplicate=true via
-- a crafted request is rejected here). Signature is UNCHANGED from 0029, so this
-- is a plain create-or-replace — no overload drop, no re-grant needed (the
-- existing grant to service_role carries over).
-- =============================================================================

create or replace function public.create_processing_post(
  p_actor_id       uuid,
  p_org_id         uuid,
  p_source_path    text,
  p_source_hash    text    default null,
  p_allow_duplicate boolean default false
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_post_id uuid;
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
  if p_source_path is null or length(p_source_path) = 0 then
    raise exception 'source path required';
  end if;

  -- The "upload anyway" override is OPERATOR-ONLY. A normal org admin cannot
  -- bypass the exact-photo dedup, even with a crafted request.
  if p_allow_duplicate and not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'superadmin'
  ) then
    raise exception 'not authorized';
  end if;

  -- Exact-photo dedup: same image bytes already captured (and not discarded).
  -- Skipped only when a SUPERADMIN explicitly confirmed "upload anyway".
  if not p_allow_duplicate
     and p_source_hash is not null and length(p_source_hash) > 0
     and exists (
       select 1 from public.posts
       where org_id = p_org_id
         and source_image_hash = p_source_hash
         and status <> 'archived'
     ) then
    raise exception 'duplicate_image';
  end if;

  -- On an allow-duplicate override, store NULL hash so the row is exempt from
  -- the partial unique index (which would otherwise raise 23505).
  insert into public.posts (org_id, status, source_image_path, source_image_hash, created_by)
  values (
    p_org_id, 'processing', p_source_path,
    case when p_allow_duplicate then null else nullif(p_source_hash, '') end,
    p_actor_id
  )
  returning id into v_post_id;

  perform public.log_audit(p_org_id, p_actor_id, 'post.captured', v_post_id,
    case when p_allow_duplicate then jsonb_build_object('allow_duplicate', true) else null end);
  return v_post_id;
end;
$$;
