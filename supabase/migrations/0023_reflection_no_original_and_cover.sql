-- =============================================================================
-- 0023_reflection_no_original_and_cover.sql
-- =============================================================================
-- Two related changes:
--
-- (A) REFLECTION originals are not retained. A Rückblick (reflection) is the
--     content type most likely to depict identifiable children. Policy: once the
--     admin PUBLISHES a reflection, the raw original (source_image_path,
--     raw-photos bucket) is DELETED — members keep only the blurred image and the
--     generated decorative cover. To make that airtight at the DB layer:
--       * publish_post FORCES clear_photo_allowed = false for reflections,
--         regardless of the param — a reflection original can NEVER be released
--         via the photo-consent path (0020). (Other types are unchanged: the
--         admin may still release their original, consent path intact.)
--       * publish_post now RETURNS the post's source_image_path, so the calling
--         server action can delete the bytes synchronously right after publish
--         (storage delete is a service-role op the SQL layer can't do itself).
--     The other content types keep the existing behaviour exactly.
--
-- (B) cover_image_path — a NON-PII, generated (text-to-image) decorative cover.
--     Built from the already-redacted extraction (title/summary/content_type),
--     carries no PII. Member-readable like redacted_image_path: granted to
--     `authenticated` and added to posts_public. NOT REVOKE'd (it is not PII),
--     unlike source_image_path.
-- =============================================================================

-- (B) generated decorative cover image path (non-PII).
alter table public.posts
  add column if not exists cover_image_path text;

-- Private bucket for the generated covers (served to members via a server-minted
-- signed URL, like redacted-photos — kept private for consistency, not secrecy:
-- the cover carries no PII). Objects are named "<org_id>/<post_id>.jpg".
insert into storage.buckets (id, name, public)
values ('cover-photos', 'cover-photos', false)
on conflict (id) do nothing;

-- Drop-then-create so the migration is re-runnable (storage policies aren't
-- covered by `if not exists`; a partial prior run would otherwise 42710).
drop policy if exists "cover_photos_admin_rw" on storage.objects;
create policy "cover_photos_admin_rw" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'cover-photos'
    and public.is_admin()
    and (storage.foldername(name))[1] = public.my_org_id()::text
  )
  with check (
    bucket_id = 'cover-photos'
    and public.is_admin()
    and (storage.foldername(name))[1] = public.my_org_id()::text
  );

-- Member-readable column grant (additive to the 0004 safe-column grant).
grant select (cover_image_path) on public.posts to authenticated;

-- Redefine posts_public to expose cover_image_path (append-only would also work,
-- but DROP+CREATE keeps this consistent with 0008's pattern and the column order
-- intent). Nothing else depends on the view (members query it directly).
drop view if exists public.posts_public;
create view public.posts_public
with (security_invoker = on)
as
  select
    id, org_id, status, title, body, category,
    content_type, health_severity, nutri_score_hidden,
    redacted_image_path, cover_image_path, extraction,
    published_at, created_by, created_at
  from public.posts
  where status = 'published';

grant select on public.posts_public to authenticated;

comment on view public.posts_public is
  'Member-facing read of posts. Omits source_image_path, ocr_text_raw, '
  'ocr_text_redacted, redactions, and content_type_suggested. Exposes the '
  'admin-confirmed content_type + health_severity + nutri_score_hidden + the '
  'generated cover_image_path. security_invoker=on so RLS on posts still '
  'governs row visibility.';

-- -----------------------------------------------------------------------------
-- (A) publish_post — reflection clear-photo lockout + return source_image_path.
-- Body copied verbatim from 0020; the ONLY changes are:
--   1. returns text (the post's source_image_path) instead of void, so the
--      caller can delete the original bytes for reflections.
--   2. clear_photo_allowed is FORCED false when content_type = 'reflection'
--      (v_clear local), so a reflection original is never released.
-- Signature (param list) is unchanged, so existing callers are unaffected.
--
-- Drop the prior void-returning overload first: Postgres cannot CREATE OR REPLACE
-- a function with a different return type.
-- -----------------------------------------------------------------------------
drop function if exists public.publish_post(uuid, uuid, text, text, text, boolean);

create or replace function public.publish_post(
  p_actor_id           uuid,
  p_post_id            uuid,
  p_content_type       text,
  p_title              text,
  p_body               text,
  p_clear_photo_allowed boolean default false
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id      uuid;
  v_norm_title  text;
  v_clear       boolean;
  v_source_path text;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
  select org_id, source_image_path into v_org_id, v_source_path
    from public.posts where id = p_post_id;
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

  -- Reflections can NEVER release their original (it is deleted post-publish).
  v_clear := coalesce(p_clear_photo_allowed, false) and p_content_type <> 'reflection';

  v_norm_title := lower(btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')));
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
    clear_photo_allowed = v_clear,
    published_at = now()
  where id = p_post_id;

  if p_content_type = 'event_notice' then
    insert into public.events (
      org_id, post_id, title, category, starts_on, ends_on,
      all_day, time_start, time_end, source_quote, status
    )
    select
      v_org_id,
      p_post_id,
      left(coalesce(nullif(btrim(item->>'title'), ''), p_title), 200),
      case
        when item->>'category' in ('closure','event','deadline')
          then item->>'category'
        else 'event'
      end,
      (item->>'starts_on')::date,
      nullif(btrim(coalesce(item->>'ends_on','')), '')::date,
      coalesce((item->>'all_day')::boolean, true),
      nullif(btrim(coalesce(item->>'time_start','')), '')::time,
      nullif(btrim(coalesce(item->>'time_end','')), '')::time,
      left(coalesce(item->>'source_quote',''), 500),
      'confirmed'
    from jsonb_array_elements(
      coalesce(
        (select extraction from public.posts where id = p_post_id)
          -> 'payload' -> 'events',
        '[]'::jsonb
      )
    ) as item
    where (item->>'starts_on') ~ '^\d{4}-\d{2}-\d{2}$'
    on conflict (post_id, starts_on, title) do nothing;

    -- Confirm pending events AND reactivate any that a prior take-down
    -- cancelled (bump ics_sequence so subscribed calendars re-add them).
    update public.events
      set status = 'confirmed',
          ics_sequence = ics_sequence + case when status = 'cancelled' then 1 else 0 end
    where post_id = p_post_id and status in ('pending', 'cancelled');
  end if;

  perform public.log_audit(v_org_id, p_actor_id, 'post.published', p_post_id,
    jsonb_build_object('content_type', p_content_type,
                       'clear_photo_allowed', v_clear));

  -- Return the original's path so the caller can delete the bytes for
  -- reflections (NULL when there was no original).
  return v_source_path;
end;
$$;
revoke all on function public.publish_post(uuid, uuid, text, text, text, boolean) from public;
grant execute on function public.publish_post(uuid, uuid, text, text, text, boolean) to service_role;

-- -----------------------------------------------------------------------------
-- (B) worker_write_draft — accept the generated cover_image_path.
-- Body copied verbatim from 0010; the ONLY change is the trailing p_cover_path
-- param (defaulted null so older callers are unaffected) written onto the post.
-- The cover is generated fail-open in the worker, so p_cover_path may be null.
-- New trailing optional param => the 10-arg signature still resolves; we add the
-- 11-arg overload and drop the old one so PostgREST resolves the new shape.
-- -----------------------------------------------------------------------------
drop function if exists public.worker_write_draft(uuid, text, text, text, jsonb, jsonb, text, text, text, text);

create or replace function public.worker_write_draft(
  p_post_id                uuid,
  p_redacted_path          text,
  p_ocr_raw                text,
  p_ocr_redacted           text,
  p_redactions             jsonb,
  p_extraction             jsonb,
  p_title                  text,
  p_body                   text,
  p_content_type_suggested text,
  p_health_severity        text default null,
  p_cover_path             text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_org_id uuid;
begin
  select org_id into v_org_id from public.posts where id = p_post_id;
  if v_org_id is null then raise exception 'post not found'; end if;

  update public.posts set
    status = 'draft',
    redacted_image_path = p_redacted_path,
    cover_image_path = p_cover_path,
    ocr_text_raw = p_ocr_raw,
    ocr_text_redacted = p_ocr_redacted,
    redactions = p_redactions,
    extraction = p_extraction,
    title = p_title,
    body = p_body,
    content_type_suggested = p_content_type_suggested,
    health_severity = p_health_severity
  where id = p_post_id;

  perform public.log_audit(v_org_id, null, 'post.draft_ready', p_post_id,
    jsonb_build_object('suggested', p_content_type_suggested));
end;
$$;
revoke all on function public.worker_write_draft(uuid, text, text, text, jsonb, jsonb, text, text, text, text, text) from public;
grant execute on function public.worker_write_draft(uuid, text, text, text, jsonb, jsonb, text, text, text, text, text) to service_role;
