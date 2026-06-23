-- =============================================================================
-- 0028_superadmin_broadcast_events.sql — operator broadcasts ONE event to all orgs
-- =============================================================================
-- The operator (superadmin) can hand-enter a single calendar event and release
-- it to ALL real orgs at once (e.g. a nationwide holiday / closure). Builds on
-- the single-org manual events (0027): each org gets its own archived carrier
-- post + confirmed event (so it shows on that org's /kalender + ICS, never on
-- /feed). All per-org copies share one broadcast_id so edit/cancel act on the
-- whole group as a unit.
--
-- "ALL REAL orgs" = every org EXCEPT operator anchor orgs. There is no
-- is_operator flag; the structurally reliable marker is "an org that hosts a
-- superadmin profile" — ensure_superadmin (0005) is the ONLY path that mints a
-- superadmin, and it ALWAYS anchors that profile in a dedicated fresh org. So we
-- exclude `orgs.id in (select org_id from profiles where role='superadmin')`.
-- This is correct even with multiple operators (each has their own anchor org).
-- Member-less org shells (created via create_org, no members yet) still receive
-- the event — harmless, it simply surfaces once the org gains members.
--
-- AUTHZ: superadmin ONLY, cross-org by design. Mirrors 0026/0027 exactly:
-- actor-guard + role re-check + security definer set search_path='' +
-- revoke public / grant service_role + log_audit.
-- =============================================================================

-- Group key tying all per-org copies of one broadcast together. Nullable:
-- existing events and single-org manual events (0027) stay NULL = not a broadcast.
alter table public.events add column if not exists broadcast_id uuid;
create index if not exists events_broadcast_id_idx on public.events(broadcast_id);

-- -----------------------------------------------------------------------------
-- broadcast create — one carrier post + one confirmed event per REAL org, all
-- sharing a fresh broadcast_id.
-- -----------------------------------------------------------------------------
create or replace function public.superadmin_broadcast_event(
  p_actor_id   uuid,
  p_title      text,
  p_category   text,
  p_starts_on  date,
  p_ends_on    date    default null,
  p_all_day    boolean default true,
  p_time_start time    default null,
  p_time_end   time    default null
)
returns uuid                         -- the broadcast_id
language plpgsql security definer set search_path = ''
as $$
declare
  v_broadcast_id uuid := gen_random_uuid();
  v_all_day      boolean := coalesce(p_all_day, true);
  v_time_start   time    := p_time_start;
  v_time_end     time    := p_time_end;
  v_title        text    := btrim(coalesce(p_title, ''));
  v_org          record;
  v_post_id      uuid;
  v_count        int := 0;
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

  -- All real orgs = every org that does NOT host a superadmin profile.
  for v_org in
    select o.id from public.orgs o
    where o.id not in (
      select p.org_id from public.profiles p where p.role = 'superadmin'
    )
  loop
    -- Per-org archived carrier post (invisible on /feed; carries the event).
    insert into public.posts (org_id, status, content_type, title, body, published_at, created_by)
    values (v_org.id, 'archived', 'event_notice', left(v_title, 120), null, now(), p_actor_id)
    returning id into v_post_id;

    insert into public.events (
      org_id, post_id, title, category, starts_on, ends_on,
      all_day, time_start, time_end, source_quote, status, broadcast_id
    )
    values (
      v_org.id, v_post_id, left(v_title, 200), p_category, p_starts_on, p_ends_on,
      v_all_day, v_time_start, v_time_end, null, 'confirmed', v_broadcast_id
    );

    v_count := v_count + 1;
  end loop;

  -- Audit against the actor's own org (one log row for the whole broadcast).
  perform public.log_audit(
    (select p.org_id from public.profiles p where p.id = p_actor_id),
    p_actor_id, 'event.broadcast_created', null,
    jsonb_build_object('broadcast_id', v_broadcast_id, 'org_count', v_count,
      'starts_on', p_starts_on, 'category', p_category));

  return v_broadcast_id;
end;
$$;

revoke all on function public.superadmin_broadcast_event(uuid, text, text, date, date, boolean, time, time) from public;
grant execute on function public.superadmin_broadcast_event(uuid, text, text, date, date, boolean, time, time) to service_role;

-- -----------------------------------------------------------------------------
-- broadcast update — edit ALL per-org copies of a broadcast in one shot.
-- -----------------------------------------------------------------------------
create or replace function public.superadmin_update_broadcast(
  p_actor_id     uuid,
  p_broadcast_id uuid,
  p_title        text,
  p_category     text,
  p_starts_on    date,
  p_ends_on      date    default null,
  p_all_day      boolean default true,
  p_time_start   time    default null,
  p_time_end     time    default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
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

  if not exists (
    select 1 from public.events where broadcast_id = p_broadcast_id
  ) then
    raise exception 'broadcast not found';
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

  -- Update every per-org copy; bump each ics_sequence so subscribers re-sync.
  update public.events set
    title        = left(v_title, 200),
    category     = p_category,
    starts_on    = p_starts_on,
    ends_on      = p_ends_on,
    all_day      = v_all_day,
    time_start   = v_time_start,
    time_end     = v_time_end,
    status       = 'confirmed',
    ics_sequence = ics_sequence + 1
  where broadcast_id = p_broadcast_id;

  -- Keep each carrier post's title consistent.
  update public.posts set title = left(v_title, 120)
  where id in (
    select e.post_id from public.events e where e.broadcast_id = p_broadcast_id
  );

  perform public.log_audit(
    (select p.org_id from public.profiles p where p.id = p_actor_id),
    p_actor_id, 'event.broadcast_updated', null,
    jsonb_build_object('broadcast_id', p_broadcast_id, 'starts_on', p_starts_on));
end;
$$;

revoke all on function public.superadmin_update_broadcast(uuid, uuid, text, text, date, date, boolean, time, time) from public;
grant execute on function public.superadmin_update_broadcast(uuid, uuid, text, text, date, date, boolean, time, time) to service_role;

-- -----------------------------------------------------------------------------
-- broadcast cancel — cancel ALL per-org copies (status='cancelled' + ICS bump),
-- so every org's subscribers get a STATUS:CANCELLED tombstone. Carriers stay
-- archived (inert).
-- -----------------------------------------------------------------------------
create or replace function public.superadmin_cancel_broadcast(
  p_actor_id     uuid,
  p_broadcast_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
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

  if not exists (
    select 1 from public.events where broadcast_id = p_broadcast_id
  ) then
    raise exception 'broadcast not found';
  end if;

  update public.events set
    status       = 'cancelled',
    ics_sequence = ics_sequence + 1
  where broadcast_id = p_broadcast_id;

  perform public.log_audit(
    (select p.org_id from public.profiles p where p.id = p_actor_id),
    p_actor_id, 'event.broadcast_cancelled', null,
    jsonb_build_object('broadcast_id', p_broadcast_id));
end;
$$;

revoke all on function public.superadmin_cancel_broadcast(uuid, uuid) from public;
grant execute on function public.superadmin_cancel_broadcast(uuid, uuid) to service_role;
