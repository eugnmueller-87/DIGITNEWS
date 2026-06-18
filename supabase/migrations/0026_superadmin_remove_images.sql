-- =============================================================================
-- 0026_superadmin_remove_images.sql — superadmin removes a post's image(s)
-- =============================================================================
-- The operator (superadmin) can manually strip the IMAGES off any post — even
-- retroactively, after publish — while the digital TEXT/content stays intact.
-- This nulls all three image columns (source_image_path / redacted_image_path /
-- cover_image_path) and RETURNS the prior paths so the caller (the server action)
-- can delete the actual bytes from the three storage buckets. Nothing else on the
-- post changes: title, body, extraction, content_type, events all stay.
--
-- Authz: superadmin ONLY, cross-org (the operator manages every org). Mirrors the
-- takedown_post pattern (actor-guard + role check + service_role-only definer),
-- but with NO org-scope match — a superadmin acts across orgs by design.
-- =============================================================================

-- We read the current paths into locals FIRST (so we can return them to the
-- caller for byte-purging), then null the columns. A single UPDATE ... RETURNING
-- would return the NEW (already-nulled) values, which is useless here.
create or replace function public.superadmin_remove_post_images(
  p_actor_id uuid, p_post_id uuid
)
returns table (
  source_image_path text,
  redacted_image_path text,
  cover_image_path text
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid;
  v_src    text;
  v_red    text;
  v_cov    text;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;

  select p.org_id, p.source_image_path, p.redacted_image_path, p.cover_image_path
    into v_org_id, v_src, v_red, v_cov
    from public.posts p where p.id = p_post_id;
  if v_org_id is null then raise exception 'post not found'; end if;

  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'superadmin'
  ) then
    raise exception 'not authorized';
  end if;

  update public.posts set
    source_image_path = null,
    redacted_image_path = null,
    cover_image_path = null
  where id = p_post_id;

  perform public.log_audit(v_org_id, p_actor_id, 'post.images_removed', p_post_id,
    jsonb_build_object(
      'had_source', v_src is not null,
      'had_redacted', v_red is not null,
      'had_cover', v_cov is not null));

  return query select v_src, v_red, v_cov;
end;
$$;

revoke all on function public.superadmin_remove_post_images(uuid, uuid) from public;
grant execute on function public.superadmin_remove_post_images(uuid, uuid) to service_role;
