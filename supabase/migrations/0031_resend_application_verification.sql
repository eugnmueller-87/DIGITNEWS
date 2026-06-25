-- =============================================================================
-- 0031_resend_application_verification.sql — admin re-sends the verify email
-- =============================================================================
-- A parent's verification email can land in spam / be missed, and the token
-- expires after 24h. This lets the org's admin (or operator) re-issue the
-- verification link for a PENDING application: it mints a FRESH token hash + new
-- 24h expiry on the SAME row, so the server can email a new link. Mirrors the
-- update branch of submit_application (0009) exactly — no new data, no new
-- privacy surface, just a token refresh.
--
-- Authz: admin of the application's org, or any superadmin — same check as
-- approve_application / reject_application (0009). Only 'pending' applications
-- can be re-sent (a 'verified' one already confirmed; 'approved'/'rejected' are
-- decided). security definer set search_path='' ; service_role only.
-- =============================================================================

create or replace function public.resend_application_verification(
  p_actor_id    uuid,
  p_app_id      uuid,
  p_token_hash  text,
  p_ttl_minutes int default 1440
)
returns text                       -- the applicant email (server emails the link)
language plpgsql security definer set search_path = ''
as $$
declare
  v public.applications%rowtype;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
  if p_token_hash is null or length(p_token_hash) = 0 then
    raise exception 'invalid input';
  end if;

  select * into v from public.applications where id = p_app_id for update;
  if not found then raise exception 'application not found'; end if;

  -- Admin of the app's org, or any superadmin (mirrors approve/reject).
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role in ('admin','superadmin') and org_id = v.org_id
  ) and not exists (
    select 1 from public.profiles where id = p_actor_id and role = 'superadmin'
  ) then
    raise exception 'not authorized';
  end if;

  -- Only a still-pending application can have its link re-sent.
  if v.status <> 'pending' then
    raise exception 'application not pending';
  end if;

  update public.applications set
    verify_token_hash = p_token_hash,
    verify_expires_at = now() + make_interval(mins => p_ttl_minutes)
  where id = p_app_id;

  perform public.log_audit(v.org_id, p_actor_id, 'application.verification_resent', p_app_id, null);
  return v.email;
end;
$$;

revoke all on function public.resend_application_verification(uuid, uuid, text, int) from public;
grant execute on function public.resend_application_verification(uuid, uuid, text, int) to service_role;
