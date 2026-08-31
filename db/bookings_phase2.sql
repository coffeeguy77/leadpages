-- db/bookings_phase2.sql
-- Incremental: waitlist + notification outbox (safe if already in bookings_schema.sql).
-- Run after db/bookings_schema.sql if that file was applied before phase 2.

create table if not exists booking_waitlist (
  id                  uuid primary key default gen_random_uuid(),
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  service_id          uuid references booking_services(id) on delete set null,
  customer_id         uuid references booking_customers(id) on delete set null,
  team_member_id      uuid references booking_team_members(id) on delete set null,
  name                text not null,
  email               text not null default '',
  phone               text not null default '',
  preferred_date      date,
  preferred_window    text not null default '',
  notes               text not null default '',
  status              text not null default 'waiting'
    check (status in ('waiting','notified','fulfilled','cancelled','expired')),
  notified_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists booking_waitlist_system_idx
  on booking_waitlist(booking_system_id, status, created_at desc);

create table if not exists booking_notifications (
  id                  uuid primary key default gen_random_uuid(),
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  booking_id          uuid references bookings(id) on delete set null,
  channel             text not null default 'email'
    check (channel in ('email','sms','push','webhook')),
  template_key        text not null default 'generic',
  to_address          text not null default '',
  subject             text not null default '',
  body_text           text not null default '',
  payload             jsonb not null default '{}'::jsonb,
  status              text not null default 'pending'
    check (status in ('pending','sent','failed','cancelled')),
  scheduled_for       timestamptz not null default now(),
  sent_at             timestamptz,
  error_message       text,
  created_at          timestamptz not null default now()
);

create index if not exists booking_notifications_due_idx
  on booking_notifications(status, scheduled_for)
  where status = 'pending';

-- RLS select for new tables (service-role writes)
do $$
begin
  alter table if exists public.booking_waitlist enable row level security;
  alter table if exists public.booking_notifications enable row level security;
  drop policy if exists bookings_select_visible on public.booking_waitlist;
  create policy bookings_select_visible on public.booking_waitlist
    for select to authenticated using (public.bookings_site_visible(site_id));
  drop policy if exists bookings_select_visible on public.booking_notifications;
  create policy bookings_select_visible on public.booking_notifications
    for select to authenticated using (public.bookings_site_visible(site_id));
exception when undefined_function then
  null;
end $$;
