-- =============================================================================
-- 0021_category_views.sql — per-member "new since last visit" counts per category
-- =============================================================================
-- The Bereiche hub shows a badge per category with how many posts were published
-- since the member last opened that category. We track one timestamp per
-- (user, category) and count published posts newer than it.
--
-- "category" is the routing key, NOT a posts column:
--   feed (all)            -> every published post
--   meal_plan / reflection / event_notice / health_notice -> that content_type
--   info                  -> content_type='info' OR content_type IS NULL
--                            (mirrors /info's includeNull — unconfirmed posts
--                             land in the general feed/Infos)
-- =============================================================================

create table if not exists public.category_views (
  user_id      uuid not null references auth.users(id) on delete cascade,
  category     text not null,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.category_views enable row level security;

-- A member reads + writes only their own view rows. (Writes also go through the
-- definer RPC below, but a direct self-scoped policy keeps it simple + safe.)
create policy "category_views_self" on public.category_views
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- mark_category_seen(category) — upsert the caller's last-seen to now(). Called
-- when a member opens a category page. Self-only (auth.uid()); validates the key.
-- -----------------------------------------------------------------------------
create or replace function public.mark_category_seen(p_category text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_category not in
     ('feed','meal_plan','reflection','event_notice','health_notice','info') then
    raise exception 'invalid category';
  end if;
  insert into public.category_views (user_id, category, last_seen_at)
  values (auth.uid(), p_category, now())
  on conflict (user_id, category)
  do update set last_seen_at = now();
end;
$$;
revoke all on function public.mark_category_seen(text) from public;
grant execute on function public.mark_category_seen(text) to authenticated;

-- -----------------------------------------------------------------------------
-- category_new_counts() — for the calling member, the number of published posts
-- in each category that are NEWER than their last-seen for that category (or all
-- of them if they've never opened it). Returns (category, new_count). Runs as
-- the caller's own org (my_org_id()); never crosses orgs.
-- -----------------------------------------------------------------------------
create or replace function public.category_new_counts()
returns table (category text, new_count bigint)
language sql security definer set search_path = ''
as $$
  with cats(category) as (
    values ('feed'),('meal_plan'),('reflection'),
           ('event_notice'),('health_notice'),('info')
  ),
  seen as (
    select category, last_seen_at
    from public.category_views
    where user_id = auth.uid()
  )
  select
    c.category,
    count(p.id) as new_count
  from cats c
  left join seen s on s.category = c.category
  left join public.posts p
    on p.org_id = public.my_org_id()
   and p.status = 'published'
   and p.published_at > coalesce(s.last_seen_at, 'epoch'::timestamptz)
   and (
        c.category = 'feed'
     or (c.category = 'info'
         and (p.content_type = 'info' or p.content_type is null))
     or (c.category not in ('feed','info') and p.content_type = c.category)
   )
  group by c.category;
$$;
revoke all on function public.category_new_counts() from public;
grant execute on function public.category_new_counts() to authenticated;
