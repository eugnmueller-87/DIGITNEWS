-- =============================================================================
-- 0014_purges.sql — scheduled data-retention purges (Brief §11/§12)
-- =============================================================================
-- Retention hygiene:
--   * audit_log entries older than 90 days
--   * pending join requests / stale applications (already have a purge fn) > 14d
--   * failed posts' raw images older than 30 days (and the failed posts)
--
-- Scheduling uses pg_cron when available (Supabase: enable the pg_cron extension
-- in the dashboard, schema 'cron'). We define the purge FUNCTIONS unconditionally
-- and only register cron jobs if the extension is present, so the migration
-- applies cleanly whether or not pg_cron is enabled yet.
-- =============================================================================

-- Purge audit_log > 90 days.
create or replace function public.purge_audit_log()
returns int
language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
  with d as (
    delete from public.audit_log where created_at < now() - interval '90 days'
    returning 1
  )
  select count(*) into n from d;
  return n;
end;
$$;
revoke all on function public.purge_audit_log() from public;
grant execute on function public.purge_audit_log() to service_role;

-- Purge failed posts older than 30 days (and let storage cleanup happen via the
-- app's storage lifecycle / a separate job; here we remove the DB rows).
create or replace function public.purge_failed_posts()
returns int
language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
  with d as (
    delete from public.posts
    where status = 'failed' and created_at < now() - interval '30 days'
    returning 1
  )
  select count(*) into n from d;
  return n;
end;
$$;
revoke all on function public.purge_failed_posts() from public;
grant execute on function public.purge_failed_posts() to service_role;

-- A single entry point the scheduler calls.
create or replace function public.run_daily_purges()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.purge_audit_log();
  perform public.purge_failed_posts();
  perform public.purge_stale_applications();
end;
$$;
revoke all on function public.run_daily_purges() from public;
grant execute on function public.run_daily_purges() to service_role;

-- Register a daily cron job IF pg_cron is installed. Idempotent.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Unschedule a prior job of the same name if present, then (re)schedule.
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'aushang-daily-purges';
    perform cron.schedule(
      'aushang-daily-purges',
      '17 3 * * *',                      -- 03:17 daily
      $cmd$ select public.run_daily_purges(); $cmd$
    );
  end if;
end $$;
