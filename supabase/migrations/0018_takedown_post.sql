-- =============================================================================
-- 0018_takedown_post.sql — admin removes an already-PUBLISHED post from the feed
-- =============================================================================
-- Take-down = depublish. Mirrors discard_post's authz, but is scoped to
-- status='published' and ALSO cancels the post's calendar events so they leave
-- /kalender (which reads status='confirmed') AND actively disappear from
-- subscribed ICS calendars (the ICS feed emits STATUS:CANCELLED for cancelled
-- events — see src/lib/ics-format.ts — so Google/Apple remove them). We bump
-- ics_sequence so subscribed clients treat it as an update, not a stale copy.
-- Status goes to 'archived' (the same terminal state discard_post uses, so the
-- raw-image purge job cleans it up). discard_post stays for drafts; this is a
-- distinct, more consequential action with its own audit code.
-- =============================================================================

create or replace function public.takedown_post(
  p_actor_id uuid, p_post_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid;
  v_status text;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'actor mismatch';
  end if;
  select org_id, status into v_org_id, v_status
    from public.posts where id = p_post_id;
  if v_org_id is null then raise exception 'post not found'; end if;
  -- Only published posts can be taken down (drafts use discard_post).
  if v_status <> 'published' then raise exception 'not published'; end if;
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role in ('admin','superadmin') and org_id = v_org_id
  ) and not exists (
    select 1 from public.profiles where id = p_actor_id and role = 'superadmin'
  ) then
    raise exception 'not authorized';
  end if;

  update public.posts set status = 'archived' where id = p_post_id;

  -- Cancel the calendar events so they leave /kalender and the ICS feed actively
  -- removes them (STATUS:CANCELLED). Bump ics_sequence so subscribed clients
  -- treat it as an update, not a stale copy.
  update public.events
    set status = 'cancelled', ics_sequence = ics_sequence + 1
    where post_id = p_post_id and status <> 'cancelled';

  perform public.log_audit(v_org_id, p_actor_id, 'post.takedown', p_post_id, null);
end;
$$;
revoke all on function public.takedown_post(uuid, uuid) from public;
grant execute on function public.takedown_post(uuid, uuid) to service_role;
