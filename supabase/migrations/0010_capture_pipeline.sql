-- =============================================================================
-- 0010_capture_pipeline.sql — Phase 2 capture → worker → draft flow
-- =============================================================================
-- The capture flow: an admin photographs a notice; the app stores the RAW image
-- in a PRIVATE storage bucket, inserts a posts row (status='processing'), and
-- triggers the VPS worker with a short-TTL signed URL. The worker OCRs, redacts
-- PII locally, blurs the image, calls the EU LLM on REDACTED text, validates the
-- structured output, and calls back. The callback writes the draft via the
-- security-definer flows below (service role) and flips status to 'draft'.
--
-- This migration adds:
--   * a private storage bucket `raw-photos` (admin-only; RAW originals) and
--     `redacted-photos` (the blurred versions members can see),
--   * worker-callback security-definer flows to write the draft + events,
--   * helper to create a processing post (admin) before triggering the worker.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Storage buckets. Both PRIVATE (no public access). Access is via signed URLs.
-- `raw-photos`: the unredacted originals — admin/worker only.
-- `redacted-photos`: the blurred images shown to members in the feed.
-- (Bucket creation is idempotent; storage.buckets is managed by Supabase.)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('raw-photos', 'raw-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('redacted-photos', 'redacted-photos', false)
on conflict (id) do nothing;

-- Storage RLS: an admin may read/write objects under their own org's prefix.
-- We name objects "<org_id>/<post_id>.jpg", so the first path segment is the
-- org id. Members never read raw-photos; they read redacted-photos via signed
-- URLs minted server-side (no direct member storage policy needed in v1).
create policy "raw_photos_admin_rw" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'raw-photos'
    and public.is_admin()
    and (storage.foldername(name))[1] = public.my_org_id()::text
  )
  with check (
    bucket_id = 'raw-photos'
    and public.is_admin()
    and (storage.foldername(name))[1] = public.my_org_id()::text
  );

create policy "redacted_photos_admin_rw" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'redacted-photos'
    and public.is_admin()
    and (storage.foldername(name))[1] = public.my_org_id()::text
  )
  with check (
    bucket_id = 'redacted-photos'
    and public.is_admin()
    and (storage.foldername(name))[1] = public.my_org_id()::text
  );

-- -----------------------------------------------------------------------------
-- create_processing_post(actor, org, source_path) — admin creates a post in
-- 'processing' state right after uploading the raw image. Returns the post id so
-- the server can build a signed URL and trigger the worker.
-- -----------------------------------------------------------------------------
create or replace function public.create_processing_post(
  p_actor_id    uuid,
  p_org_id      uuid,
  p_source_path text
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

  insert into public.posts (org_id, status, source_image_path, created_by)
  values (p_org_id, 'processing', p_source_path, p_actor_id)
  returning id into v_post_id;

  perform public.log_audit(p_org_id, p_actor_id, 'post.captured', v_post_id, null);
  return v_post_id;
end;
$$;
revoke all on function public.create_processing_post(uuid, uuid, text) from public;
grant execute on function public.create_processing_post(uuid, uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- worker_write_draft(post, redacted_path, ocr_raw, ocr_redacted, redactions,
--                    extraction, content_type_suggested, health_severity)
-- Called by the worker CALLBACK (service role) on a successful pipeline run.
-- Writes the redacted artifacts + the validated extraction, mirrors the LLM's
-- content_type SUGGESTION (admin confirms it later), and flips status to 'draft'.
-- Does NOT set content_type (the confirmed value) — that's the admin's job in
-- review. Does NOT create events yet — those are created at publish from the
-- confirmed extraction, OR here as pending; we create them pending so the review
-- UI can show them.
-- -----------------------------------------------------------------------------
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
  p_health_severity        text default null
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
revoke all on function public.worker_write_draft(uuid, text, text, text, jsonb, jsonb, text, text, text, text) from public;
grant execute on function public.worker_write_draft(uuid, text, text, text, jsonb, jsonb, text, text, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- worker_mark_failed(post, reason) — called by the worker callback when OCR or
-- LLM validation fails. Flips status to 'failed' so the admin can handle it
-- manually. Reason is stored PII-free (a short code/message).
-- -----------------------------------------------------------------------------
create or replace function public.worker_mark_failed(
  p_post_id uuid,
  p_reason  text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_org_id uuid;
begin
  select org_id into v_org_id from public.posts where id = p_post_id;
  if v_org_id is null then raise exception 'post not found'; end if;
  update public.posts set status = 'failed' where id = p_post_id;
  perform public.log_audit(v_org_id, null, 'post.failed', p_post_id,
    jsonb_build_object('reason', left(coalesce(p_reason,''), 200)));
end;
$$;
revoke all on function public.worker_mark_failed(uuid, text) from public;
grant execute on function public.worker_mark_failed(uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- publish_post(actor, post, content_type, title, body, nutri_hidden) — admin
-- confirms + publishes a draft. Sets the CONFIRMED content_type, flips to
-- 'published', and (for event_notice) confirms any pending events. Returns void.
-- The structured post_details for meal_plan/reflection are upserted separately
-- by the server from the (admin-edited) extraction before calling this.
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
declare v_org_id uuid;
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

-- discard_post(actor, post) — admin discards a draft (archived, not deleted, so
-- the raw image purge job can clean it later).
create or replace function public.discard_post(
  p_actor_id uuid, p_post_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_org_id uuid;
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
  update public.posts set status = 'archived' where id = p_post_id;
  perform public.log_audit(v_org_id, p_actor_id, 'post.discarded', p_post_id, null);
end;
$$;
revoke all on function public.discard_post(uuid, uuid) from public;
grant execute on function public.discard_post(uuid, uuid) to service_role;
