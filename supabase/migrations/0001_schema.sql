-- =============================================================================
-- 0001_schema.sql — core tables
-- =============================================================================
-- Aushang data model (Brief §4). Five core tables + audit log + ics tokens.
-- RLS is enabled here but policies live in 0003_rls.sql; helper/security-definer
-- functions live in 0002_functions.sql. Order matters: tables (0001) →
-- functions (0002) → policies that call those functions (0003).
--
-- Conventions:
--   * Every domain table is org-scoped via org_id and has RLS enabled.
--   * gen_random_uuid() comes from pgcrypto (built into Supabase).
--   * timestamptz everywhere; app logic assumes Europe/Berlin for display only.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- orgs
-- -----------------------------------------------------------------------------
create table public.orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  slug        text unique not null,
  org_type    text not null check (org_type in ('kita','verein','kirche','betrieb','sonstiges')),
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
-- role is NEVER client-settable. It is written exclusively by the security-
-- definer flows in 0002 (create_org / redeem_invite / approve_join_request).
-- The member-facing UPDATE policy in 0003 explicitly forbids changing role/org.
create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  org_id               uuid not null references public.orgs(id) on delete cascade,
  role                 text not null default 'member' check (role in ('admin','member')),
  display_name         text,
  email_digest_opt_in  boolean not null default true,
  created_at           timestamptz not null default now()
);
create index profiles_org_id_idx on public.profiles(org_id);

-- -----------------------------------------------------------------------------
-- invites (org-scoped join codes)
-- -----------------------------------------------------------------------------
create table public.invites (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.orgs(id) on delete cascade,
  code              text unique not null,   -- human-shareable, e.g. 'sonnenschein-7f3k'
  role              text not null default 'member' check (role in ('admin','member')),
  requires_approval boolean not null default true,
  max_uses          int check (max_uses is null or max_uses > 0), -- null = unlimited
  use_count         int not null default 0,
  expires_at        timestamptz,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index invites_org_id_idx on public.invites(org_id);

-- -----------------------------------------------------------------------------
-- join_requests (created when invite.requires_approval = true)
-- -----------------------------------------------------------------------------
create table public.join_requests (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  invite_id   uuid not null references public.invites(id) on delete cascade,
  email       text not null,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now()
);
create index join_requests_org_status_idx on public.join_requests(org_id, status);

-- -----------------------------------------------------------------------------
-- posts (one per photographed notice)
-- -----------------------------------------------------------------------------
-- ocr_text_raw and redactions carry pre-redaction PII context and are NEVER
-- exposed to members. The member-facing read is via the public view in 0003,
-- which omits those columns. Members only ever see status='published'.
create table public.posts (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.orgs(id) on delete cascade,
  status              text not null default 'processing'
                        check (status in ('processing','draft','published','archived','failed')),
  title               text,
  body                text,                 -- redacted, admin-edited final text
  category            text check (category in ('event','deadline','call_to_action','info')),
  source_image_path   text not null,        -- private bucket path, RAW original (admin-only)
  redacted_image_path text,                 -- blurred version shown in feed
  ocr_text_raw        text,                 -- ADMIN-ONLY. Never in member view.
  ocr_text_redacted   text,
  redactions          jsonb,                -- [{placeholder,type,confidence,bbox,kept}]  ADMIN-ONLY
  extraction          jsonb,                -- full LLM response, schema-validated
  published_at        timestamptz,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index posts_org_status_idx on public.posts(org_id, status);

-- -----------------------------------------------------------------------------
-- events (always born from a post)
-- -----------------------------------------------------------------------------
create table public.events (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  post_id       uuid not null references public.posts(id) on delete cascade,
  title         text not null,
  category      text not null check (category in ('closure','event','deadline')),
  starts_on     date not null,
  ends_on       date,                        -- null = single day
  all_day       boolean not null default true,
  time_start    time,
  time_end      time,
  source_quote  text,                        -- literal text the date came from
  status        text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  ics_sequence  int not null default 0,      -- bump on every change for ICS clients
  created_at    timestamptz not null default now()
);
create index events_org_status_idx on public.events(org_id, status);
create index events_post_id_idx on public.events(post_id);

-- -----------------------------------------------------------------------------
-- audit_log (write-only via security-definer fn; admin-readable; 90-day purge)
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  org_id      uuid,
  actor_id    uuid,
  action      text not null,   -- 'invite.created','invite.redeemed','join.approved',...
  target_id   uuid,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_org_created_idx on public.audit_log(org_id, created_at desc);

-- -----------------------------------------------------------------------------
-- ics_tokens (per-user revocable calendar subscription)
-- -----------------------------------------------------------------------------
create table public.ics_tokens (
  token       text primary key,             -- random 32+ chars, unguessable
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  org_id      uuid not null references public.orgs(id) on delete cascade,
  revoked     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index ics_tokens_profile_idx on public.ics_tokens(profile_id);

-- -----------------------------------------------------------------------------
-- Enable RLS on every table. With RLS on and no policy, access is DENIED by
-- default — exactly what we want until 0003 grants the narrow allowances.
-- -----------------------------------------------------------------------------
alter table public.orgs           enable row level security;
alter table public.profiles       enable row level security;
alter table public.invites        enable row level security;
alter table public.join_requests  enable row level security;
alter table public.posts          enable row level security;
alter table public.events         enable row level security;
alter table public.audit_log      enable row level security;
alter table public.ics_tokens     enable row level security;

-- Force RLS even for the table owner, so a mistaken owner-context query can't
-- silently bypass policies. (service_role uses BYPASSRLS, which is separate and
-- intentional for our server-side security-definer flows.)
alter table public.orgs           force row level security;
alter table public.profiles       force row level security;
alter table public.invites        force row level security;
alter table public.join_requests  force row level security;
alter table public.posts          force row level security;
alter table public.events         force row level security;
alter table public.audit_log      force row level security;
alter table public.ics_tokens     force row level security;
