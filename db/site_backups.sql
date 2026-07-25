-- db/site_backups.sql
-- Smart site config backups — point-in-time snapshots of sites.config.
-- Idempotent: safe to re-run in Supabase SQL editor.
--
-- Payload is design/content JSON only (not leads, domains, Cloudinary binaries).

create table if not exists site_backups (
  id                    uuid primary key default gen_random_uuid(),
  site_id               uuid not null references sites(id) on delete cascade,
  label                 text not null default 'Backup',
  config                jsonb not null default '{}'::jsonb,
  size_bytes            integer not null default 0,
  source                text not null default 'manual'
    check (source in (
      'manual',
      'pre_publish',
      'pre_restore',
      'pre_import',
      'theme_apply',
      'website_studio',
      'auto'
    )),
  actor_user_id         uuid references profiles(id) on delete set null,
  config_hash           text,
  restored_from_id      uuid references site_backups(id) on delete set null,
  created_at            timestamptz not null default now()
);

comment on table site_backups is
  'Site config restore points. Smart sources: manual, pre_publish, pre_restore, pre_import, theme_apply, website_studio, auto.';

-- Legacy installs may already have the table without smart columns.
alter table site_backups add column if not exists size_bytes integer not null default 0;
alter table site_backups add column if not exists source text not null default 'manual';
alter table site_backups add column if not exists actor_user_id uuid references profiles(id) on delete set null;
alter table site_backups add column if not exists config_hash text;
alter table site_backups add column if not exists restored_from_id uuid references site_backups(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'site_backups_source_check'
  ) then
    alter table site_backups
      add constraint site_backups_source_check
      check (source in (
        'manual',
        'pre_publish',
        'pre_restore',
        'pre_import',
        'theme_apply',
        'website_studio',
        'auto'
      ));
  end if;
exception when others then
  -- Ignore if constraint already matches / column type drift
  null;
end $$;

create index if not exists site_backups_site_created_idx
  on site_backups (site_id, created_at desc);

create index if not exists site_backups_site_source_idx
  on site_backups (site_id, source, created_at desc);

create index if not exists site_backups_site_hash_idx
  on site_backups (site_id, config_hash, created_at desc);

-- Service role API is the write path; enable RLS for direct client reads if used.
alter table site_backups enable row level security;

-- Owner / partner / super can read their site backups via JWT (optional; API uses service role).
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'site_backups' and policyname = 'site_backups_select_own'
  ) then
    create policy site_backups_select_own on site_backups
      for select to authenticated
      using (
        exists (
          select 1 from sites s
          where s.id = site_backups.site_id
            and (
              s.owner_user_id = auth.uid()
              or exists (
                select 1 from profiles p
                where p.id = auth.uid() and p.is_super_admin = true
              )
              or exists (
                select 1 from partners pr
                where pr.user_id = auth.uid()
                  and pr.status = 'active'
                  and (pr.id = s.servicing_partner_id or pr.id = s.referring_partner_id)
              )
            )
        )
      );
  end if;
end $$;
