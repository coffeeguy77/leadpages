-- Order Operations Phase 5: print report snapshots (changes since last print)
-- Apply in Supabase SQL editor or via migration runner.

create table if not exists order_print_snapshots (
  id                uuid primary key default gen_random_uuid(),
  order_system_id   uuid not null references order_systems(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  pickup_date       date not null,
  format            text not null
    check (format in ('day_run', 'prep', 'pick_list', 'allocation', 'label', 'item_labels')),
  fingerprint       text not null,
  order_count       integer not null default 0,
  line_count        integer not null default 0,
  payload_summary   jsonb not null default '{}'::jsonb,
  printed_by        uuid references profiles(id) on delete set null,
  printed_at        timestamptz not null default now()
);

create index if not exists order_print_snapshots_lookup_idx
  on order_print_snapshots(order_system_id, pickup_date, format, printed_at desc);

comment on table order_print_snapshots is
  'Staff print snapshots — fingerprint of pickup-date + format content for changes-since-print.';
