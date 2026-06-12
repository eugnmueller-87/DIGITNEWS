-- =============================================================================
-- 0013_push_subscriptions.sql — Web Push (VAPID) subscriptions
-- =============================================================================
-- Stores per-user browser push subscriptions so the app can notify members when
-- their org publishes. Opt-in. RLS: a user manages their OWN subscriptions; the
-- server (service role) reads an org's subscriptions to send.
-- =============================================================================

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  org_id      uuid not null references public.orgs(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index push_subscriptions_org_idx on public.push_subscriptions(org_id);
create index push_subscriptions_profile_idx on public.push_subscriptions(profile_id);

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

-- A user manages their own subscriptions.
create policy push_owner_all on public.push_subscriptions
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and org_id = public.my_org_id());

-- Superadmins can read across orgs (operator support).
create policy push_superadmin_read on public.push_subscriptions
  for select to authenticated
  using (public.is_superadmin());
