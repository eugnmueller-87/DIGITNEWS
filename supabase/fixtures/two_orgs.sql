-- =============================================================================
-- two_orgs.sql — isolation test fixture
-- =============================================================================
-- Seeds two orgs with one admin + one member each, plus a published post and a
-- confirmed event in each. Use to verify the Phase 1 acceptance criterion:
--   "two test users in two orgs cannot see each other's anything."
--
-- HOW TO USE (against a LOCAL supabase, never prod):
--   1. supabase start
--   2. Create four auth users via the Auth admin API or studio, note their UUIDs.
--   3. Replace the :'..._uid' placeholders below with those UUIDs.
--   4. psql < this file  (runs as the postgres superuser, bypassing RLS to seed).
--   5. Then, impersonating each user (set request.jwt.claims), confirm that
--      cross-org SELECTs return zero rows. See README "Testing RLS".
--
-- This file is NOT applied automatically and must never run against production.
-- =============================================================================

-- \set org_a_admin_uid '00000000-0000-0000-0000-00000000a001'
-- \set org_a_member_uid '00000000-0000-0000-0000-00000000a002'
-- \set org_b_admin_uid '00000000-0000-0000-0000-00000000b001'
-- \set org_b_member_uid '00000000-0000-0000-0000-00000000b002'

do $$
declare
  org_a uuid;
  org_b uuid;
  post_a uuid;
  post_b uuid;
begin
  insert into public.orgs (name, slug, org_type)
    values ('Kita Sonnenschein', 'kita-sonnenschein', 'kita') returning id into org_a;
  insert into public.orgs (name, slug, org_type)
    values ('SV Eintracht', 'sv-eintracht', 'verein') returning id into org_b;

  -- NOTE: profiles reference auth.users(id). When running this fixture, the four
  -- UUIDs above must already exist in auth.users. Uncomment + substitute:
  -- insert into public.profiles (id, org_id, role, display_name) values
  --   (:'org_a_admin_uid'::uuid,  org_a, 'admin',  'Admin A'),
  --   (:'org_a_member_uid'::uuid, org_a, 'member', 'Member A'),
  --   (:'org_b_admin_uid'::uuid,  org_b, 'admin',  'Admin B'),
  --   (:'org_b_member_uid'::uuid, org_b, 'member', 'Member B');

  insert into public.posts (org_id, status, title, body, category, source_image_path, published_at)
    values (org_a, 'published', 'Sommerfest A', 'Body A', 'event', 'raw/a.jpg', now())
    returning id into post_a;
  insert into public.posts (org_id, status, title, body, category, source_image_path, published_at)
    values (org_b, 'published', 'Sommerfest B', 'Body B', 'event', 'raw/b.jpg', now())
    returning id into post_b;

  insert into public.events (org_id, post_id, title, category, starts_on, status)
    values (org_a, post_a, 'Sommerfest A', 'event', current_date + 7, 'confirmed');
  insert into public.events (org_id, post_id, title, category, starts_on, status)
    values (org_b, post_b, 'Sommerfest B', 'event', current_date + 7, 'confirmed');

  raise notice 'Seeded org_a=% org_b=%', org_a, org_b;
end $$;
