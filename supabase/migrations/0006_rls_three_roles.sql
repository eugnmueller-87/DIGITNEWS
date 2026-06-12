-- =============================================================================
-- 0006_rls_three_roles.sql — RLS for the three-role operator model
-- =============================================================================
-- Adds superadmin cross-org access and aligns existing policies with the new
-- is_admin() (which now means admin-OR-superadmin) and is_superadmin().
--
-- Policy intent recap:
--   member     — read own-org published posts / confirmed events. No writes.
--   admin      — full CRUD within own org (is_admin() is true for admins).
--   superadmin — cross-org read/write everywhere (operator). is_admin() is also
--                true for superadmins, so the existing *_admin_all policies
--                already grant them their OWN org; the superadmin_* policies
--                below extend that to ALL orgs.
--
-- The invites/join_requests policies were dropped with their tables (0005).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- orgs: superadmins can read + write every org (create happens via create_org
-- service-role flow; this enables listing/renaming from the operator UI).
-- -----------------------------------------------------------------------------
create policy orgs_superadmin_all on public.orgs
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- -----------------------------------------------------------------------------
-- profiles: superadmins can read every profile (operator member lists across
-- orgs). Writes to role/membership still go through the security-definer flows
-- (set_admin / add_person / remove_person), so no broad superadmin write policy
-- is granted here — keeping role changes funneled through audited functions.
-- -----------------------------------------------------------------------------
create policy profiles_superadmin_read on public.profiles
  for select to authenticated
  using (public.is_superadmin());

-- -----------------------------------------------------------------------------
-- posts: superadmins get full cross-org access (operator support/debugging).
-- -----------------------------------------------------------------------------
create policy posts_superadmin_all on public.posts
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- -----------------------------------------------------------------------------
-- events: superadmins get full cross-org access.
-- -----------------------------------------------------------------------------
create policy events_superadmin_all on public.events
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- -----------------------------------------------------------------------------
-- audit_log: superadmins can read every org's audit trail.
-- -----------------------------------------------------------------------------
create policy audit_superadmin_read on public.audit_log
  for select to authenticated
  using (public.is_superadmin());

-- -----------------------------------------------------------------------------
-- Note on PII columns: the column-level REVOKE from 0004 still applies to ALL of
-- `authenticated` (admins AND superadmins). PII access remains server-only via
-- the service role for everyone, by construction. We deliberately do NOT grant
-- PII columns back to superadmins at the column level.
-- =============================================================================
