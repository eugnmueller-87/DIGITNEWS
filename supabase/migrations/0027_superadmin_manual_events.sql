-- =============================================================================
-- 0027_superadmin_manual_events.sql — operator hand-enters calendar events
-- =============================================================================
-- The operator (superadmin) can create / edit / cancel a calendar event BY HAND
-- for ANY org — no photo, no worker, no LLM. This is the deterministic
-- counterpart to the capture pipeline: the operator types the event directly.
--
-- WHY A CARRIER POST (and not a schema change):
-- events.post_id is `not null references posts(id) on delete cascade` (0001:104)
-- — every event is, by construction, born from a post. Rather than relax that
-- invariant (which would break the dedup unique index, ON DELETE CASCADE, and
-- publish_post / takedown_post's joins on events.post_id), each manual event
-- hangs on a lightweight SYNTHETIC carrier post, strictly 1:1. The carrier is
-- inserted with status='archived' so it is INVISIBLE on /feed and every section
-- view (posts_public filters WHERE status='published', 0023:70) — yet the event
-- still shows on /kalender + ICS, which read the events table and gate ONLY on
-- events.status='confirmed', never the post's status (0003:122-124, kalender,
-- ics.ts). source_image_path is nullable since 0026:23, so a carrier with no
-- photo is legitimate.
--
-- LIFECYCLE: create => carrier(archived) + event(confirmed). edit => UPDATE the
-- event (+ carrier title) and bump ics_sequence. delete => CANCEL (status=
-- 'cancelled' + ics_sequence+1) so ICS emits a STATUS:CANCELLED tombstone and
-- subscribed external calendars REMOVE it; the carrier is left archived (inert).
-- Repeated create/cancel leaves archived carrier rows behind — inert, invisible,
-- not a leak (purge_failed_posts only deletes status='failed', 0014:43).
--
-- AUTHZ: superadmin ONLY, cross-org by design (the operator manages every org).
-- Mirrors superadmin_remove_post_images (0026): actor-guard + role re-check +
-- security definer set search_path='' + revoke public / grant service_role.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- create — mint a carrier post + one confirmed event in the chosen org.
-- -----------------------------------------------------------------------------
create or replace function public.superadmin_create_event(
  p_actor_id   uuid,
  p_org_id     uuid,
  p_title      text,
  p_category   text,
  p_starts_on  date,
  p_ends_on    date    default null,
  p_all_day    boolean default true,
  p_time_start time    default null,
  p_time_end   time    default null
)
returns uuid                         -- the new event id
language plpgsql security definer set search_path = ''
as $$
declare
  v_post_id    uuid;
  v_event_id   uuid;
  v_all_day    boolean := coalesce(p_all_day, true);
  v_time_start time    := p_time_start;
  v_time_end   time    := p_time_end;
  v_title      text    := btrim(coalesce(p_title, ''));
begin
  -- Actor-guard (mirrors 0026:44).
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;

  -- Superadmin ONLY, cross-org — NO org-scope match (mirrors 0026:53-58).
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'superadmin'
  ) then
    raise exception 'not authorized';
  end if;

  -- The operator may target ANY existing org.
  if not exists (select 1 from public.orgs o where o.id = p_org_id) then
    raise exception 'org not found';
  end if;

  -- Field validation (defence in depth; the server action validates first).
  if length(v_title) = 0 then
    raise exception 'title required';
  end if;
  if p_category not in ('closure', 'event', 'deadline') then
    raise exception 'invalid category';
  end if;
  if p_starts_on is null then
    raise exception 'starts_on required';
  end if;
  if p_ends_on is not null and p_ends_on < p_starts_on then
    raise exception 'end before start';
  end if;

  -- All-day events carry no times (keeps ICS all-day rendering clean).
  if v_all_day then
    v_time_start := null;
    v_time_end := null;
  end if;

  -- Synthetic carrier post: archived (invisible on /feed + sections), no image,
  -- no posts.category (that vocabulary differs from events.category — leave NULL).
  insert into public.posts (org_id, status, content_type, title, body, published_at, created_by)
  values (p_org_id, 'archived', 'event_notice', left(v_title, 120), null, now(), p_actor_id)
  returning id into v_post_id;

  -- The event — confirmed, so members see it immediately.
  insert into public.events (
    org_id, post_id, title, category, starts_on, ends_on,
    all_day, time_start, time_end, source_quote, status
  )
  values (
    p_org_id, v_post_id, left(v_title, 200), p_category, p_starts_on, p_ends_on,
    v_all_day, v_time_start, v_time_end, null, 'confirmed'
  )
  returning id into v_event_id;

  perform public.log_audit(p_org_id, p_actor_id, 'event.created_manually', v_post_id,
    jsonb_build_object('event_id', v_event_id, 'starts_on', p_starts_on, 'category', p_category));

  return v_event_id;
end;
$$;

revoke all on function public.superadmin_create_event(uuid, uuid, text, text, date, date, boolean, time, time) from public;
grant execute on function public.superadmin_create_event(uuid, uuid, text, text, date, date, boolean, time, time) to service_role;

-- -----------------------------------------------------------------------------
-- update — edit a manual event in place; bump ics_sequence so subscribed
-- external calendars pick up the change (per the 0001:114 column contract).
-- -----------------------------------------------------------------------------
create or replace function public.superadmin_update_event(
  p_actor_id   uuid,
  p_event_id   uuid,
  p_title      text,
  p_category   text,
  p_starts_on  date,
  p_ends_on    date    default null,
  p_all_day    boolean default true,
  p_time_start time    default null,
  p_time_end   time    default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id     uuid;
  v_post_id    uuid;
  v_all_day    boolean := coalesce(p_all_day, true);
  v_time_start time    := p_time_start;
  v_time_end   time    := p_time_end;
  v_title      text    := btrim(coalesce(p_title, ''));
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'superadmin'
  ) then
    raise exception 'not authorized';
  end if;

  select e.org_id, e.post_id into v_org_id, v_post_id
    from public.events e where e.id = p_event_id;
  if v_org_id is null then
    raise exception 'event not found';
  end if;

  if length(v_title) = 0 then
    raise exception 'title required';
  end if;
  if p_category not in ('closure', 'event', 'deadline') then
    raise exception 'invalid category';
  end if;
  if p_starts_on is null then
    raise exception 'starts_on required';
  end if;
  if p_ends_on is not null and p_ends_on < p_starts_on then
    raise exception 'end before start';
  end if;

  if v_all_day then
    v_time_start := null;
    v_time_end := null;
  end if;

  update public.events set
    title        = left(v_title, 200),
    category     = p_category,
    starts_on    = p_starts_on,
    ends_on      = p_ends_on,
    all_day      = v_all_day,
    time_start   = v_time_start,
    time_end     = v_time_end,
    status       = 'confirmed',           -- re-confirm in case it was cancelled
    ics_sequence = ics_sequence + 1       -- subscribed calendars re-sync
  where id = p_event_id;

  -- Keep the carrier post's title consistent with the event.
  update public.posts set title = left(v_title, 120) where id = v_post_id;

  perform public.log_audit(v_org_id, p_actor_id, 'event.updated_manually', v_post_id,
    jsonb_build_object('event_id', p_event_id, 'starts_on', p_starts_on, 'category', p_category));
end;
$$;

revoke all on function public.superadmin_update_event(uuid, uuid, text, text, date, date, boolean, time, time) from public;
grant execute on function public.superadmin_update_event(uuid, uuid, text, text, date, date, boolean, time, time) to service_role;

-- -----------------------------------------------------------------------------
-- delete — CANCEL (not hard-delete): set status='cancelled' + bump ics_sequence
-- so ICS emits STATUS:CANCELLED and subscribed calendars REMOVE the event. The
-- event vanishes from /kalender (its status<>'confirmed'). The carrier post is
-- left 'archived' (already invisible); we do not touch it, avoiding the
-- ON DELETE CASCADE path. Mirrors takedown_post's cancel semantics (0018).
-- -----------------------------------------------------------------------------
create or replace function public.superadmin_delete_event(
  p_actor_id uuid,
  p_event_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id  uuid;
  v_post_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'superadmin'
  ) then
    raise exception 'not authorized';
  end if;

  select e.org_id, e.post_id into v_org_id, v_post_id
    from public.events e where e.id = p_event_id;
  if v_org_id is null then
    raise exception 'event not found';
  end if;

  update public.events set
    status       = 'cancelled',
    ics_sequence = ics_sequence + 1
  where id = p_event_id;

  perform public.log_audit(v_org_id, p_actor_id, 'event.cancelled_manually', v_post_id,
    jsonb_build_object('event_id', p_event_id));
end;
$$;

revoke all on function public.superadmin_delete_event(uuid, uuid) from public;
grant execute on function public.superadmin_delete_event(uuid, uuid) to service_role;
