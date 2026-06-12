-- =============================================================================
-- 0003_rls.sql — Row Level Security policies + member-safe views
-- =============================================================================
-- RLS is already ENABLED + FORCED on every table (0001). With no policy, all
-- access is denied. This file grants the narrow, explicit allowances.
--
-- Mental model:
--   * `authenticated` role = a logged-in end user (admin or member). Subject to
--     RLS. This is what the browser/anon-key client and the server-with-user-
--     session use.
--   * `service_role` = the server's elevated key. Has BYPASSRLS. Used only for
--     the security-definer flows. NOT governed by these policies.
--   * Members: read PUBLISHED posts / CONFIRMED events in their OWN org. Nothing
--     else. No writes.
--   * Admins: full CRUD within their OWN org (never cross-org).
--   * profiles.role / org_id are never client-updatable (enforced below).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- orgs
-- -----------------------------------------------------------------------------
-- Any member of an org may read their own org row (for name/branding).
create policy orgs_read_own on public.orgs
  for select to authenticated
  using (id = public.my_org_id());

-- Admins may update their own org (e.g. rename). No insert/delete from client;
-- creation is via create_org_and_admin() (service role), deletion via cascade.
create policy orgs_admin_update on public.orgs
  for update to authenticated
  using (id = public.my_org_id() and public.is_admin())
  with check (id = public.my_org_id() and public.is_admin());

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
-- A user can read their own profile + (for admins) all profiles in their org.
create policy profiles_read_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_admin_read_org on public.profiles
  for select to authenticated
  using (org_id = public.my_org_id() and public.is_admin());

-- A user can update ONLY their own profile, and ONLY the safe columns. The
-- WITH CHECK clause re-asserts that org_id and role are unchanged by comparing
-- against the existing row via a subquery. role/org_id changes are impossible
-- from the client; they are only ever set by security-definer flows.
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and org_id = (select p.org_id from public.profiles p where p.id = auth.uid())
  );

-- No client INSERT/DELETE on profiles. Creation = security-definer flows;
-- deletion = delete_user_account() cascade from auth.users.

-- -----------------------------------------------------------------------------
-- invites
-- -----------------------------------------------------------------------------
-- Admins manage invites within their own org.
create policy invites_admin_read on public.invites
  for select to authenticated
  using (org_id = public.my_org_id() and public.is_admin());

create policy invites_admin_insert on public.invites
  for insert to authenticated
  with check (org_id = public.my_org_id() and public.is_admin());

create policy invites_admin_update on public.invites
  for update to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

create policy invites_admin_delete on public.invites
  for delete to authenticated
  using (org_id = public.my_org_id() and public.is_admin());

-- NOTE: looking up an invite by code during join happens server-side via the
-- service role (request_join / redeem_invite), NOT via these policies. There is
-- deliberately NO anon/public read policy on invites — codes are never
-- enumerable through the API.

-- -----------------------------------------------------------------------------
-- join_requests
-- -----------------------------------------------------------------------------
-- Admins read/manage join requests for their org. Creation is service-role only
-- (request_join). Members never see them.
create policy join_requests_admin_read on public.join_requests
  for select to authenticated
  using (org_id = public.my_org_id() and public.is_admin());

create policy join_requests_admin_update on public.join_requests
  for update to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

-- -----------------------------------------------------------------------------
-- posts
-- -----------------------------------------------------------------------------
-- Members: read PUBLISHED posts of their own org only. (PII columns are still
-- present on the base table; the member-facing read path uses the public view
-- below, which omits them. This base policy is the org+status gate.)
create policy posts_member_read on public.posts
  for select to authenticated
  using (org_id = public.my_org_id() and status = 'published');

-- Admins: full access within their own org.
create policy posts_admin_all on public.posts
  for all to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

-- -----------------------------------------------------------------------------
-- events
-- -----------------------------------------------------------------------------
-- Members: read CONFIRMED events of their own org only.
create policy events_member_read on public.events
  for select to authenticated
  using (org_id = public.my_org_id() and status = 'confirmed');

-- Admins: full access within their own org.
create policy events_admin_all on public.events
  for all to authenticated
  using (org_id = public.my_org_id() and public.is_admin())
  with check (org_id = public.my_org_id() and public.is_admin());

-- -----------------------------------------------------------------------------
-- audit_log
-- -----------------------------------------------------------------------------
-- Admins may READ their org's audit log. Writes happen ONLY via log_audit()
-- (security definer) — there is intentionally NO insert/update/delete policy,
-- so the log is append-only-via-function and immutable from any client.
create policy audit_admin_read on public.audit_log
  for select to authenticated
  using (org_id = public.my_org_id() and public.is_admin());

-- -----------------------------------------------------------------------------
-- ics_tokens
-- -----------------------------------------------------------------------------
-- A user manages their own calendar tokens. The ICS endpoint itself resolves
-- the token server-side via the service role (unauthenticated calendar client).
create policy ics_tokens_owner_read on public.ics_tokens
  for select to authenticated
  using (profile_id = auth.uid());

create policy ics_tokens_owner_insert on public.ics_tokens
  for insert to authenticated
  with check (profile_id = auth.uid() and org_id = public.my_org_id());

create policy ics_tokens_owner_update on public.ics_tokens
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- =============================================================================
-- Member-safe public view for posts — omits PII/raw columns
-- =============================================================================
-- Members read posts through this view, which excludes ocr_text_raw and
-- redactions (pre-redaction PII context). The view runs with the querying
-- user's privileges (security_invoker = on, PG15+/Supabase default-capable),
-- so the underlying posts_member_read RLS policy still applies — the view can
-- never widen access, only narrow the column set.
create view public.posts_public
with (security_invoker = on)
as
  select
    id, org_id, status, title, body, category,
    redacted_image_path,        -- blurred image only; never source_image_path
    extraction,
    published_at, created_at
  from public.posts
  where status = 'published';

grant select on public.posts_public to authenticated;

comment on view public.posts_public is
  'Member-facing read of posts. Omits source_image_path, ocr_text_raw, '
  'ocr_text_redacted, redactions. security_invoker=on so RLS on posts still '
  'governs row visibility.';
