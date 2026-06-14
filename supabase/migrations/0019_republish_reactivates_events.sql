-- =============================================================================
-- 0019_republish_reactivates_events.sql — re-publishing restores its events
-- =============================================================================
-- BUG (from 0018 take-down): take-down sets a post's events to 'cancelled'. If
-- the admin later re-publishes that post, publish_post (0017) did
-- INSERT ... ON CONFLICT DO NOTHING (rows already exist, so no-op) and then only
-- confirmed events whose status was 'pending' — so the 'cancelled' events stayed
-- cancelled and the post came back to the feed WITHOUT its calendar dates.
--
-- Fix: publish_post now ALSO flips this post's 'cancelled' events back to
-- 'confirmed' (and bumps ics_sequence so subscribed calendars re-add them). Only
-- change vs 0017 is the final events UPDATE: status in ('pending','cancelled').
-- =============================================================================

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
    jsonb_build_object('content_type', p_content_type));
end;
$$;
revoke all on function public.publish_post(uuid, uuid, text, text, text) from public;
grant execute on function public.publish_post(uuid, uuid, text, text, text) to service_role;
