-- =============================================================================
-- 0016_dedup_posts.sql — duplicate prevention for captures & published posts
-- =============================================================================
-- Two independent layers, both enforced in the security-definer write path so
-- they can't be bypassed by a route (LLM advises, deterministic code decides):
--
--   1. Exact-photo block at CAPTURE. We store a SHA-256 of the uploaded image
--      bytes on the post and refuse a second capture of the same bytes for the
--      same org. A partial UNIQUE index is the DB backstop against the
--      check-then-insert race; create_processing_post raises a clean
--      'duplicate_image' before inserting for the common case.
--
--   2. Same-title (+ same start date for events) block at PUBLISH. publish_post
--      refuses to publish if the org already has a PUBLISHED post with the same
--      normalized title — raising 'duplicate_title'. For event_notice we also
--      require the start date to match, so a recurring title on a different day
--      is allowed but the literal same notice is not.
--
-- Both raised conditions are mapped to neutral German messages in the UI.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1a. Hash column + partial unique index.
--     Excludes archived posts (a discarded duplicate may be re-captured) and
--     legacy/NULL hashes (pre-0016 rows, and the worker-failed path).
-- -----------------------------------------------------------------------------
alter table public.posts
  add column if not exists source_image_hash text;

create unique index if not exists posts_org_source_hash_uniq
  on public.posts (org_id, source_image_hash)
  where source_image_hash is not null and status <> 'archived';

-- -----------------------------------------------------------------------------
-- 1b. create_processing_post — now takes the image hash and rejects a duplicate
--     capture for the org. Signature changes (adds p_source_hash), so we drop
--     the old 3-arg version and re-grant. NULL/empty hash is allowed (skips the
--     check) so a client that can't hash still works — the index only enforces
--     uniqueness among non-null hashes.
-- -----------------------------------------------------------------------------
drop function if exists public.create_processing_post(uuid, uuid, text);

create or replace function public.create_processing_post(
  p_actor_id    uuid,
  p_org_id      uuid,
  p_source_path text,
  p_source_hash text default null
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
  if p_source_hash is not null and length(p_source_hash) > 0 and exists (
    select 1 from public.posts
    where org_id = p_org_id
      and source_image_hash = p_source_hash
      and status <> 'archived'
  ) then
    raise exception 'duplicate_image';
  end if;

  insert into public.posts (org_id, status, source_image_path, source_image_hash, created_by)
  values (p_org_id, 'processing', p_source_path, nullif(p_source_hash, ''), p_actor_id)
  returning id into v_post_id;

  perform public.log_audit(p_org_id, p_actor_id, 'post.captured', v_post_id, null);
  return v_post_id;
end;
$$;
revoke all on function public.create_processing_post(uuid, uuid, text, text) from public;
grant execute on function public.create_processing_post(uuid, uuid, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- 2. publish_post — same-title (+ date for events) block.
--    Normalization (lower + btrim, collapse inner whitespace) lives here so the
--    route can't bypass it. We compare against already-PUBLISHED posts in the
--    org, excluding this post id. For event_notice the matching published post
--    must also share the start date of THIS post's pending events; for other
--    types title alone is enough.
-- -----------------------------------------------------------------------------
create or replace function public.publish_post(
  p_actor_id     uuid,
  p_post_id      uuid,
  p_content_type text,
  p_title        text,
  p_body         text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id      uuid;
  v_norm_title  text;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
  select org_id into v_org_id from public.posts where id = p_post_id;
  if v_org_id is null then raise exception 'post not found'; end if;
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role in ('admin','superadmin') and org_id = v_org_id
  ) and not exists (
    select 1 from public.profiles where id = p_actor_id and role = 'superadmin'
  ) then
    raise exception 'not authorized';
  end if;
  if p_content_type not in ('meal_plan','reflection','health_notice','event_notice','info') then
    raise exception 'invalid content_type';
  end if;

  -- Normalize: trim, lowercase, collapse runs of whitespace to a single space.
  v_norm_title := lower(btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')));

  -- Same-title block. Empty titles are not deduped (validation requires a title
  -- upstream, but be defensive). For event_notice, also require a shared start
  -- date so a recurring-titled notice on a different day is still allowed.
  if length(v_norm_title) > 0 and exists (
    select 1
    from public.posts p
    where p.org_id = v_org_id
      and p.id <> p_post_id
      and p.status = 'published'
      and lower(btrim(regexp_replace(coalesce(p.title, ''), '\s+', ' ', 'g'))) = v_norm_title
      and (
        p_content_type <> 'event_notice'
        or exists (
          select 1
          from public.events e_new
          join public.events e_old
            on e_old.post_id = p.id
           and e_old.starts_on = e_new.starts_on
          where e_new.post_id = p_post_id
        )
      )
  ) then
    raise exception 'duplicate_title';
  end if;

  update public.posts set
    status = 'published',
    content_type = p_content_type,
    title = p_title,
    body = p_body,
    published_at = now()
  where id = p_post_id;

  -- For event posts, confirm any pending events so they hit the calendar/ICS.
  if p_content_type = 'event_notice' then
    update public.events set status = 'confirmed'
    where post_id = p_post_id and status = 'pending';
  end if;

  perform public.log_audit(v_org_id, p_actor_id, 'post.published', p_post_id,
    jsonb_build_object('content_type', p_content_type));
end;
$$;
revoke all on function public.publish_post(uuid, uuid, text, text, text) from public;
grant execute on function public.publish_post(uuid, uuid, text, text, text) to service_role;
