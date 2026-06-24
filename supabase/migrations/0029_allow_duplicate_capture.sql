-- =============================================================================
-- 0029_allow_duplicate_capture.sql — "upload anyway?" override for re-capture
-- =============================================================================
-- The exact-photo dedup (0016) hard-blocks a second capture of the same image
-- bytes for an org. That's right for accidental re-captures, but the admin
-- sometimes legitimately needs to re-post a notice that was removed during
-- testing (e.g. a lice/Läuse notice taken down, now needed again). The UI now
-- detects the duplicate, asks "Dieses Foto wurde schon aufgenommen — trotzdem
-- hochladen?", and on confirm re-calls with p_allow_duplicate=true.
--
-- When p_allow_duplicate is true we do TWO things:
--   (a) skip the 'duplicate_image' raise, AND
--   (b) store source_image_hash = NULL on the new post.
-- (b) is load-bearing: the partial unique index posts_org_source_hash_uniq
-- (0016) covers only NON-NULL hashes, so a NULL-hash row is exempt from the
-- index and would otherwise still raise 23505. A NULL hash is already a valid,
-- supported shape (pre-0016 rows, worker-failed path — see 0016 header).
--
-- CONSEQUENCE (intended): the allow-duplicate copy carries no hash, so it never
-- participates in future dedup. The ORIGINAL still carries its hash and keeps
-- anchoring detection, so a THIRD capture of the same bytes still trips the
-- warning (and can be confirmed again). source_image_hash is read NOWHERE except
-- this dedup check (no worker/query/type), so nulling it breaks no consumer.
--
-- Signature gains p_allow_duplicate (4-arg -> 5-arg). We DROP the 4-arg overload
-- first so PostgREST can't hit overload ambiguity (PGRST203) on the existing
-- 4-named-arg call; then re-grant the 5-arg version to service_role only.
-- =============================================================================

drop function if exists public.create_processing_post(uuid, uuid, text, text);

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

  -- Exact-photo dedup: same image bytes already captured (and not discarded).
  -- Skipped entirely when the admin explicitly confirmed "upload anyway".
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

revoke all on function public.create_processing_post(uuid, uuid, text, text, boolean) from public;
grant execute on function public.create_processing_post(uuid, uuid, text, text, boolean) to service_role;
