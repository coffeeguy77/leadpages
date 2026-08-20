-- Order Engine: import / SMS CRM / customer portal OTP
-- Run after db/order_engine_schema.sql + db/order_engine_rls.sql

-- Normalised phone for customer match / SMS login
alter table order_customers
  add column if not exists phone_e164 text;

create unique index if not exists order_customers_system_phone_e164_uidx
  on order_customers (order_system_id, phone_e164)
  where phone_e164 is not null and phone_e164 <> '';

create index if not exists order_customers_phone_e164_idx
  on order_customers (site_id, phone_e164);

-- SMS opt-in + CRM broadcast safety
alter table order_customers
  add column if not exists sms_opt_in boolean not null default true;

alter table order_customers
  add column if not exists external_ref text;

-- Allow imported / historical order numbers (unique per system when set)
alter table order_orders
  add column if not exists external_order_number text;

create unique index if not exists order_orders_system_external_number_uidx
  on order_orders (order_system_id, external_order_number)
  where external_order_number is not null and external_order_number <> '';

-- Expand access token purposes for customer sessions + OTP
alter table order_access_tokens
  drop constraint if exists order_access_tokens_purpose_check;

alter table order_access_tokens
  add constraint order_access_tokens_purpose_check
  check (purpose in (
    'portal', 'deposit', 'reorder', 'portal_customer', 'sms_otp'
  ));

alter table order_access_tokens
  alter column order_id drop not null;

alter table order_access_tokens
  add column if not exists customer_id uuid references order_customers(id) on delete cascade;

alter table order_access_tokens
  add column if not exists order_system_id uuid references order_systems(id) on delete cascade;

alter table order_access_tokens
  add column if not exists meta jsonb not null default '{}'::jsonb;

create index if not exists order_access_tokens_customer_idx
  on order_access_tokens (customer_id, purpose);

-- Billable SMS meter (one row per successful/attempted billable send)
create table if not exists order_sms_usage (
  id                uuid primary key default gen_random_uuid(),
  order_system_id   uuid not null references order_systems(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  customer_id       uuid references order_customers(id) on delete set null,
  order_id          uuid references order_orders(id) on delete set null,
  message_id        uuid references order_messages(id) on delete set null,
  kind              text not null default 'transactional'
    check (kind in (
      'transactional', 'otp', 'broadcast', 'abandoned', 'import_notice', 'other'
    )),
  destination       text not null,
  segments          integer not null default 1,
  billable          boolean not null default true,
  provider_id       text,
  status            text not null default 'sent'
    check (status in ('sent', 'failed', 'skipped')),
  meta              jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists order_sms_usage_site_created_idx
  on order_sms_usage (site_id, created_at desc);

create index if not exists order_sms_usage_system_kind_idx
  on order_sms_usage (order_system_id, kind, created_at desc);

alter table order_sms_usage enable row level security;

drop policy if exists order_sms_usage_select_visible on order_sms_usage;
create policy order_sms_usage_select_visible on order_sms_usage
  for select using (order_engine_site_visible(site_id));

-- Import run audit (optional preview/commit history)
create table if not exists order_import_runs (
  id                uuid primary key default gen_random_uuid(),
  order_system_id   uuid not null references order_systems(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  kind              text not null
    check (kind in ('customers', 'products', 'order_history')),
  filename          text,
  mapping           jsonb not null default '{}'::jsonb,
  stats             jsonb not null default '{}'::jsonb,
  status            text not null default 'preview'
    check (status in ('preview', 'committed', 'failed')),
  created_by        uuid,
  created_at        timestamptz not null default now(),
  committed_at      timestamptz
);

create index if not exists order_import_runs_site_idx
  on order_import_runs (site_id, created_at desc);

alter table order_import_runs enable row level security;

drop policy if exists order_import_runs_select_visible on order_import_runs;
create policy order_import_runs_select_visible on order_import_runs
  for select using (order_engine_site_visible(site_id));
