-- db/quote_systems_rls.sql
-- RLS for online quote system tables.
-- Serverless APIs use service_role and bypass RLS; these policies protect direct
-- Supabase client access from the browser (defence in depth).

alter table quote_systems enable row level security;
alter table quote_system_config_versions enable row level security;
alter table quote_sessions enable row level security;
alter table quote_versions enable row level security;
alter table quote_verifications enable row level security;
alter table quote_verified_emails enable row level security;

-- quote_systems: site owners / partners / super admins may read their binding row.
-- Writes go through service-role APIs only (no insert/update policies for anon).

create policy quote_systems_select_owner on quote_systems
  for select using (
    exists (
      select 1 from sites s
      where s.id = quote_systems.site_id
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
              and (s.servicing_partner_id = pr.id or s.referring_partner_id = pr.id)
          )
        )
    )
  );

-- Config versions: same site access as quote_systems (read only from browser).
create policy quote_config_versions_select_owner on quote_system_config_versions
  for select using (
    exists (
      select 1 from quote_systems qs
      join sites s on s.id = qs.site_id
      where qs.id = quote_system_config_versions.quote_system_id
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
              and (s.servicing_partner_id = pr.id or s.referring_partner_id = pr.id)
          )
        )
    )
  );

-- Sessions + versions: site staff read; public visitor access is via API tokens only.
create policy quote_sessions_select_owner on quote_sessions
  for select using (
    exists (
      select 1 from sites s
      where s.id = quote_sessions.site_id
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
              and (s.servicing_partner_id = pr.id or s.referring_partner_id = pr.id)
          )
        )
    )
  );

create policy quote_versions_select_owner on quote_versions
  for select using (
    exists (
      select 1 from sites s
      where s.id = quote_versions.site_id
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
              and (s.servicing_partner_id = pr.id or s.referring_partner_id = pr.id)
          )
        )
    )
  );

-- Verifications: no browser policies — service role only.
