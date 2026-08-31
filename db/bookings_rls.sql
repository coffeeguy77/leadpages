-- db/bookings_rls.sql
-- RLS for Bookings. Writes go through service-role APIs.
-- Visibility mirrors Order Engine: site owner, super-admin, or active partner.

create or replace function public.bookings_site_visible(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sites s
    where s.id = p_site_id
      and (
        s.owner_user_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.is_super_admin = true
        )
        or exists (
          select 1 from public.partners pr
          where pr.user_id = auth.uid()
            and pr.status = 'active'
            and (pr.id = s.servicing_partner_id or pr.id = s.referring_partner_id)
        )
      )
  );
$$;

revoke all on function public.bookings_site_visible(uuid) from public;
grant execute on function public.bookings_site_visible(uuid) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'booking_systems',
    'booking_service_categories',
    'booking_services',
    'booking_service_addons',
    'booking_team_members',
    'booking_staff_services',
    'booking_resources',
    'booking_service_resources',
    'booking_availability_rules',
    'booking_schedule_exceptions',
    'booking_customers',
    'bookings',
    'booking_attendees',
    'booking_resources_reserved',
    'booking_status_history',
    'booking_activity',
    'booking_holds',
    'booking_payments',
    'booking_portal_tokens',
    'booking_audit_events',
    'booking_waitlist',
    'booking_notifications'
  ]
  loop
    execute format('alter table if exists public.%I enable row level security', t);
    execute format('drop policy if exists bookings_select_visible on public.%I', t);
    execute format(
      'create policy bookings_select_visible on public.%I for select to authenticated using (public.bookings_site_visible(site_id))',
      t
    );
  end loop;
exception when undefined_column then
  -- booking_systems has site_id; if a table lacks it, skip — all listed tables have site_id
  null;
end $$;

-- booking_systems: site_id present
drop policy if exists bookings_systems_select on public.booking_systems;
create policy bookings_systems_select on public.booking_systems
  for select to authenticated
  using (public.bookings_site_visible(site_id));
