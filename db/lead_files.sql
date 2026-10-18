-- Lead file uploads (Quote form → "File uploads").
-- Private bucket: visitors upload through one-time signed upload URLs handed out by
-- /api/lead-files/sign; files are only read through /api/lead-files/open (short-lived
-- signed download URLs). No RLS policies are added, so anon/authenticated clients can
-- neither list nor read the bucket directly — only the service role can.
--
-- Object path: <site_id>/<yyyymm>/<upload_id>/<n>-<safe-name>
-- Kept 90 days, then removed by /api/cron/lead-files-cleanup (daily). Uploads never
-- attached to a lead are removed after 24 hours.
-- Free plan: 1 GB storage across the org — the app caps lead files at 500 MB total
-- and 100 MB per site per month (lib/lead-files.js).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lead-files', 'lead-files', false, 10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Bytes used: this site this calendar month (UTC), and the whole bucket.
create or replace function public.lead_files_usage(p_site text)
returns table (site_month_bytes bigint, total_bytes bigint)
language sql
security definer
set search_path = ''
as $$
  select
    coalesce(sum((o.metadata->>'size')::bigint) filter (
      where o.name like p_site || '/%' and o.created_at >= date_trunc('month', now())
    ), 0)::bigint,
    coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
  from storage.objects o
  where o.bucket_id = 'lead-files';
$$;

-- Objects to delete: older than the retention period, or not on any lead after the grace period.
create or replace function public.lead_files_due(p_keep_days int default 90, p_orphan_hours int default 24, p_limit int default 500)
returns table (name text, reason text)
language sql
security definer
set search_path = ''
as $$
  select o.name, case when o.created_at < now() - make_interval(days => p_keep_days) then 'expired' else 'orphan' end
  from storage.objects o
  where o.bucket_id = 'lead-files'
    and (
      o.created_at < now() - make_interval(days => p_keep_days)
      or (
        o.created_at < now() - make_interval(hours => p_orphan_hours)
        and not exists (
          select 1 from public.leads l
          where l.details ? 'files'
            and l.details->'files' @> jsonb_build_array(jsonb_build_object('path', o.name))
        )
      )
    )
  order by o.created_at
  limit p_limit;
$$;

-- After the files are removed: mark leads whose files are gone.
create or replace function public.lead_files_mark_expired(p_paths text[])
returns integer
language sql
security definer
set search_path = ''
as $$
  with hit as (
    update public.leads l
       set details = l.details || jsonb_build_object('filesExpired', true)
     where l.details ? 'files'
       and coalesce((l.details->>'filesExpired')::boolean, false) = false
       and exists (
         select 1 from jsonb_array_elements(l.details->'files') f
         where f->>'path' = any(p_paths)
       )
    returning 1
  )
  select count(*)::int from hit;
$$;

revoke all on function public.lead_files_usage(text) from public, anon, authenticated;
revoke all on function public.lead_files_due(int, int, int) from public, anon, authenticated;
revoke all on function public.lead_files_mark_expired(text[]) from public, anon, authenticated;
grant execute on function public.lead_files_usage(text) to service_role;
grant execute on function public.lead_files_due(int, int, int) to service_role;
grant execute on function public.lead_files_mark_expired(text[]) to service_role;
