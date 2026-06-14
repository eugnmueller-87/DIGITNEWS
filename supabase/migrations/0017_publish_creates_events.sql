-- =============================================================================
-- 0017_publish_creates_events.sql — event_notice posts actually create events
-- =============================================================================
-- BUG this fixes: events were NEVER inserted. worker_write_draft stores the
-- validated extraction on posts.extraction (jsonb), and publish_post only did
-- `update events set status='confirmed' ... where status='pending'` — but no
-- pending events ever existed, so event_notice posts never reached /kalender or
-- the ICS feed.
--
-- Fix: when an admin publishes an event_notice, publish_post now INSERTs the
-- events straight from the admin-confirmed extraction
-- (posts.extraction -> 'payload' -> 'events', shape = EventNoticeItem[] from
-- src/lib/content/types.ts) as CONFIRMED rows. Deterministic code creates the
-- rows from the validated payload — the LLM only advised.
--
-- Re-publish safety: a partial UNIQUE index on (post_id, starts_on, title)
-- means re-running publish for the same post never double-inserts (the INSERT
-- uses ON CONFLICT DO NOTHING).
-- =============================================================================

-- Dedupe backstop: one event per (post, start date, title).
create unique index if not exists events_post_start_title_uniq
  on public.events (post_id, starts_on, title);

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

  -- Normalize + same-title block (unchanged from 0016).
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

  -- Event posts: create the calendar events from the admin-confirmed extraction,
  -- then confirm them. INSERT first (so they exist), idempotent via the unique
  -- index; the subsequent confirm catches any pre-existing pending rows too.
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
    -- Only rows with a parseable start date; skip malformed entries.
    where (item->>'starts_on') ~ '^\d{4}-\d{2}-\d{2}$'
    on conflict (post_id, starts_on, title) do nothing;

    update public.events set status = 'confirmed'
    where post_id = p_post_id and status = 'pending';
  end if;

  perform public.log_audit(v_org_id, p_actor_id, 'post.published', p_post_id,
    jsonb_build_object('content_type', p_content_type));
end;
$$;
revoke all on function public.publish_post(uuid, uuid, text, text, text) from public;
grant execute on function public.publish_post(uuid, uuid, text, text, text) to service_role;
