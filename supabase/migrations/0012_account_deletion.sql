-- =============================================================================
-- 0012_account_deletion.sql — GDPR self-deletion (Brief §12)
-- =============================================================================
-- Lets a user delete their OWN account. Mirrors remove_person's safeguards but
-- self-scoped: a member just deletes themselves; an admin who is the LAST admin
-- of their org cannot self-delete (would orphan the org) — they must hand off or
-- the operator deletes the org. A superadmin (operator) is not deletable here.
-- =============================================================================

create or replace function public.delete_own_account(p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_admin_count int;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'not authorized';
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    -- Already gone; idempotent.
    return;
  end if;

  if v_profile.role = 'superadmin' then
    raise exception 'operator account cannot be self-deleted here';
  end if;

  if v_profile.role = 'admin' then
    select count(*) into v_admin_count
    from public.profiles where org_id = v_profile.org_id and role = 'admin';
    if v_admin_count <= 1 then
      raise exception 'cannot delete the last admin of an org';
    end if;
  end if;

  perform public.log_audit(v_profile.org_id, p_user_id, 'user.self_deleted', p_user_id,
    jsonb_build_object('role', v_profile.role));

  -- Remove the auth user; the profile (and any owned ics_tokens) cascade.
  delete from auth.users where id = p_user_id;
end;
$$;
revoke all on function public.delete_own_account(uuid) from public;
grant execute on function public.delete_own_account(uuid) to service_role;
