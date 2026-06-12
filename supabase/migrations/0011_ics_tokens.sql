-- =============================================================================
-- 0011_ics_tokens.sql — per-user ICS calendar subscription flows
-- =============================================================================
-- The ics_tokens table already exists (0001). This adds the security-definer
-- flows the server uses to mint / resolve / revoke a per-user calendar token,
-- and the events read for the public (unauthenticated) ICS endpoint.
--
-- Security: calendar clients can't send auth headers, so the ICS GET is
-- unauthenticated — security = an unguessable token + revocability + the feed
-- containing ONLY that user's org's confirmed events. The token is resolved
-- server-side via the service role (no anon RLS on ics_tokens beyond the owner
-- read added in 0003/0004).
-- =============================================================================

-- create_ics_token(actor) — mint (or return the existing active) calendar token
-- for the caller. One active token per user; re-issuing revokes the old one.
create or replace function public.create_ics_token(
  p_actor_id uuid,
  p_token    text
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_org_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
  select org_id into v_org_id from public.profiles where id = p_actor_id;
  if v_org_id is null then raise exception 'no profile'; end if;
  if p_token is null or length(p_token) < 24 then
    raise exception 'token too short';
  end if;

  -- Revoke any prior active tokens (rotate).
  update public.ics_tokens set revoked = true
  where profile_id = p_actor_id and revoked = false;

  insert into public.ics_tokens (token, profile_id, org_id)
  values (p_token, p_actor_id, v_org_id);

  return p_token;
end;
$$;
revoke all on function public.create_ics_token(uuid, text) from public;
grant execute on function public.create_ics_token(uuid, text) to service_role;

-- revoke_ics_tokens(actor) — revoke all of the caller's calendar tokens.
create or replace function public.revoke_ics_tokens(p_actor_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
  update public.ics_tokens set revoked = true
  where profile_id = p_actor_id and revoked = false;
end;
$$;
revoke all on function public.revoke_ics_tokens(uuid) from public;
grant execute on function public.revoke_ics_tokens(uuid) to service_role;

-- resolve_ics_token(token) — for the PUBLIC ICS endpoint. Returns the org_id of
-- a live (non-revoked) token, else null. Service-role only.
create or replace function public.resolve_ics_token(p_token text)
returns uuid
language sql security definer set search_path = ''
stable
as $$
  select org_id from public.ics_tokens
  where token = p_token and revoked = false
$$;
revoke all on function public.resolve_ics_token(text) from public;
grant execute on function public.resolve_ics_token(text) to service_role;
