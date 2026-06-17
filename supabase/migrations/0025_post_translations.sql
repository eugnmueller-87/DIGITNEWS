-- =============================================================================
-- 0025_post_translations.sql — AI translations of member-visible post content
-- =============================================================================
-- We translate post CONTENT (title, body, and the structured payload strings)
-- into the non-German UI locales (en, ru) so members reading the app in those
-- languages see localized notices, not German. German stays the source of truth
-- on `posts` / `post_details` / `events`; translations are ADDITIVE side rows.
--
-- Flow (see worker + review/actions): on publish the web app fires a best-effort
-- translate call to the worker (Mistral/EU, on already-REDACTED text); the worker
-- POSTs translations back and they are written here via a security-definer RPC.
-- Publishing never waits for or depends on translation (publish-anyway): if a row
-- is missing, read sites fall back to the German original.
--
-- PII: translations derive ONLY from the member-safe, already-redacted title/body/
-- payload — never from ocr_text_raw or the source image. So these tables carry no
-- new PII and follow the same member-safe grants as post_details (whole-table
-- SELECT to authenticated; RLS governs WHICH rows).
--
-- Multi-tenant: every row carries org_id and is gated by my_org_id() + the parent
-- being published/confirmed, exactly like post_details / events.
--
-- IDEMPOTENT: drop-then-create at the top so this is safe to re-run by hand in the
-- SQL editor (a partial run leaves the first table behind, and a plain re-run would
-- then fail with "relation already exists"). The tables are additive translation
-- caches — dropping them only discards already-recomputable translations, never
-- source content (German lives on posts/post_details/events). The live DB was
-- hand-applied with exactly these guards.
-- =============================================================================

drop table if exists public.post_translations cascade;
drop table if exists public.event_translations cascade;
drop function if exists public.write_post_translations(uuid, jsonb, jsonb);

-- -----------------------------------------------------------------------------
-- post_translations — one row per (post, locale). Mirrors the translatable shape
-- of a post: title, body, and a payload jsonb that mirrors posts.extraction.payload
-- (and post_details.payload) with the human-readable strings translated. Structure
-- per content_type matches the German source 1:1; only string values change.
-- -----------------------------------------------------------------------------
create table public.post_translations (
  post_id     uuid not null references public.posts(id) on delete cascade,
  org_id      uuid not null references public.orgs(id) on delete cascade,
  locale      text not null check (locale in ('en', 'ru')),
  title       text,
  body        text,
  -- Translated mirror of the post's structured payload (dish names, day summaries,
  -- health topic/action, info sections, event titles). Same keys as the German
  -- source; null when the post has no structured payload (plain info/health).
  payload     jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (post_id, locale)
);
create index post_translations_org_idx on public.post_translations(org_id);

comment on table public.post_translations is
  'AI translations (en, ru) of member-visible post content. German source lives '
  'on posts/post_details. Additive + best-effort: a missing row => German fallback. '
  'Derived only from already-redacted, member-safe text -> no new PII.';

-- -----------------------------------------------------------------------------
-- event_translations — one row per (event, locale). Event names are the only
-- member-visible event text (dates/times are locale-formatted in code).
-- -----------------------------------------------------------------------------
create table public.event_translations (
  event_id    uuid not null references public.events(id) on delete cascade,
  org_id      uuid not null references public.orgs(id) on delete cascade,
  locale      text not null check (locale in ('en', 'ru')),
  title       text not null,
  created_at  timestamptz not null default now(),
  primary key (event_id, locale)
);
create index event_translations_org_idx on public.event_translations(org_id);

comment on table public.event_translations is
  'AI translations (en, ru) of event titles. German source lives on events.title. '
  'Additive + best-effort: a missing row => German fallback.';

-- -----------------------------------------------------------------------------
-- RLS — mirror post_details exactly: members read translations whose parent post
-- is published (resp. event confirmed) in their own org; admins full in-org;
-- superadmins cross-org. ENABLE + FORCE per house style (0001).
-- -----------------------------------------------------------------------------
alter table public.post_translations enable row level security;
alter table public.post_translations force row level security;

create policy post_translations_member_read on public.post_translations
  for select to authenticated
  using (
    org_id = public.my_org_id()
    and exists (
      select 1 from public.posts p
      where p.id = post_translations.post_id and p.status = 'published'
    )
  );

create policy post_translations_admin_all on public.post_translations
  for all to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

create policy post_translations_superadmin_all on public.post_translations
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

alter table public.event_translations enable row level security;
alter table public.event_translations force row level security;

create policy event_translations_member_read on public.event_translations
  for select to authenticated
  using (
    org_id = public.my_org_id()
    and exists (
      select 1 from public.events e
      where e.id = event_translations.event_id and e.status = 'confirmed'
    )
  );

create policy event_translations_admin_all on public.event_translations
  for all to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

create policy event_translations_superadmin_all on public.event_translations
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- No PII -> whole-table SELECT for authenticated is member-safe (RLS governs rows).
grant select on public.post_translations to authenticated;
grant select on public.event_translations to authenticated;

-- -----------------------------------------------------------------------------
-- write_post_translations — the ONLY writer. Service-role-only security-definer,
-- search_path-pinned, re-checks the post exists and pins org_id from the post so
-- a caller can never plant a row under the wrong tenant. Upsert per locale so a
-- re-translate (admin re-publish / backfill re-run) overwrites cleanly.
--
-- p_translations shape (jsonb object keyed by locale):
--   { "en": {"title": "...", "body": "...", "payload": {...}|null},
--     "ru": {"title": "...", "body": "...", "payload": {...}|null} }
-- Unknown/extra locales are ignored (CHECK would reject anyway); a locale whose
-- value is null/absent is skipped. Event titles travel with the post that created
-- them via p_event_titles: { "en": {"<event_id>": "title", ...}, "ru": {...} }.
-- -----------------------------------------------------------------------------
create or replace function public.write_post_translations(
  p_post_id       uuid,
  p_translations  jsonb,
  p_event_titles  jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid;
  v_locale text;
  v_node   jsonb;
  v_evid   text;
  v_etitle text;
begin
  select org_id into v_org_id from public.posts where id = p_post_id;
  if v_org_id is null then raise exception 'post not found'; end if;

  -- Post-level translations: one upsert per allowed locale present in the input.
  for v_locale in select jsonb_object_keys(coalesce(p_translations, '{}'::jsonb))
  loop
    if v_locale not in ('en', 'ru') then continue; end if;
    v_node := p_translations -> v_locale;
    if v_node is null or jsonb_typeof(v_node) <> 'object' then continue; end if;

    insert into public.post_translations
      (post_id, org_id, locale, title, body, payload, updated_at)
    values (
      p_post_id, v_org_id, v_locale,
      nullif(v_node ->> 'title', ''),
      nullif(v_node ->> 'body', ''),
      case when jsonb_typeof(v_node -> 'payload') = 'object'
        then v_node -> 'payload' else null end,
      now()
    )
    on conflict (post_id, locale) do update set
      title = excluded.title,
      body = excluded.body,
      payload = excluded.payload,
      updated_at = now();
  end loop;

  -- Event-title translations: events belong to this org (created at publish from
  -- this post). Pin org_id from the event row; skip ids that don't resolve in-org.
  for v_locale in select jsonb_object_keys(coalesce(p_event_titles, '{}'::jsonb))
  loop
    if v_locale not in ('en', 'ru') then continue; end if;
    for v_evid, v_etitle in
      select key, value #>> '{}'
      from jsonb_each(p_event_titles -> v_locale)
    loop
      if v_etitle is null or v_etitle = '' then continue; end if;
      -- v_evid is an LLM-produced JSON key. Validate it as a UUID BEFORE the cast:
      -- a malformed key would otherwise raise from `::uuid` and abort the whole
      -- RPC transaction, rolling back the post-level translations inserted above
      -- (one bad event key would wipe ALL of a post's translations). Skip instead.
      if v_evid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then continue; end if;
      insert into public.event_translations (event_id, org_id, locale, title)
      select e.id, e.org_id, v_locale, left(v_etitle, 200)
      from public.events e
      where e.id = v_evid::uuid and e.org_id = v_org_id
      on conflict (event_id, locale) do update set title = excluded.title;
    end loop;
  end loop;

  perform public.log_audit(v_org_id, null, 'post.translated', p_post_id,
    jsonb_build_object('locales',
      (select coalesce(jsonb_agg(key), '[]'::jsonb)
       from jsonb_object_keys(coalesce(p_translations, '{}'::jsonb)) as t(key))));
end;
$$;

revoke all on function public.write_post_translations(uuid, jsonb, jsonb) from public;
grant execute on function public.write_post_translations(uuid, jsonb, jsonb) to service_role;
