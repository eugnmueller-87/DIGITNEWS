-- =============================================================================
-- 0020_photo_consent.sql — show the CLEAR (original) photo to opted-in members
-- =============================================================================
-- Until now members only ever saw the BLURRED image (redacted_image_path). The
-- raw original (source_image_path, raw-photos bucket) was admin-only. Testing
-- showed the blurred Rückblick photos are too poor to be useful — and the board
-- photo is the same one hanging on the wall in the Kita, fine to show to parents
-- who want it.
--
-- This adds a DOUBLE-GATED path to the original, never a silent default:
--   * profiles.photo_consent   — the MEMBER opts in (per viewer), default false.
--   * posts.clear_photo_allowed — the ADMIN releases THIS post, default false.
-- A member sees the clear original only when BOTH are true; the decision is made
-- SERVER-SIDE (service-role signed URL of raw-photos), never by the client.
--
-- Security: source_image_path stays REVOKE'd from `authenticated` (0004) — the
-- only way a member reaches the original is a server-minted, short-TTL signed
-- URL gated on the AND of the two flags. A member can flip their own
-- photo_consent but NEVER clear_photo_allowed (only publish_post writes it).
-- Neither column enters posts_public. Both default false ⇒ every already-
-- published post is safe with zero backfill.
-- =============================================================================

-- Member opt-in. profiles was never column-REVOKE'd, and profiles_read_self /
-- profiles_update_self already let a member read + self-update their own row
-- (role/org pinned), so this needs NO new grant — exactly like email_digest_opt_in.
alter table public.profiles
  add column if not exists photo_consent boolean not null default false;

-- Admin per-post gate. Members never read this directly (the server decides via
-- the service role), so NO member grant and it stays out of posts_public.
alter table public.posts
  add column if not exists clear_photo_allowed boolean not null default false;

-- -----------------------------------------------------------------------------
-- publish_post — now also persists the admin's per-post clear-photo release.
-- Body copied verbatim from 0019 (dup-title guard + event reactivation); the
-- ONLY additions are the trailing p_clear_photo_allowed param (defaulted false
-- so older callers are unaffected) and writing it on the post.
--
-- Drop the prior 5-arg overload first so PostgREST can't resolve a stale
-- signature once the 6-arg version exists.
-- -----------------------------------------------------------------------------
drop function if exists public.publish_post(uuid, uuid, text, text, text);

create or replace function public.publish_post(
  p_actor_id           uuid,
  p_post_id            uuid,
  p_content_type       text,
  p_title              text,
  p_body               text,
  p_clear_photo_allowed boolean default false
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
    clear_photo_allowed = coalesce(p_clear_photo_allowed, false),
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
                       'clear_photo_allowed', coalesce(p_clear_photo_allowed, false)));
end;
$$;
revoke all on function public.publish_post(uuid, uuid, text, text, text, boolean) from public;
grant execute on function public.publish_post(uuid, uuid, text, text, text, boolean) to service_role;
