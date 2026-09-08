-- db/bookings_hire.sql
-- Vehicle & Equipment Hire extensions for LeadPages Bookings.
-- Additive / idempotent. Run after db/bookings_schema.sql (+ phase2 / rls).
-- Money: integer cents. Times: timestamptz UTC + business timezone on booking_systems.

-- ── Resource hire profile columns ────────────────────────────────────────────

alter table booking_resources
  add column if not exists internal_name text not null default '',
  add column if not exists public_name text not null default '',
  add column if not exists short_code text not null default '',
  add column if not exists slug text not null default '',
  add column if not exists registration_number text not null default '',
  add column if not exists fleet_number text not null default '',
  add column if not exists vin_or_serial text not null default '',
  add column if not exists make text not null default '',
  add column if not exists model text not null default '',
  add column if not exists year_built integer,
  add column if not exists calendar_colour text not null default '#155c4a',
  add column if not exists text_colour text not null default '#ffffff',
  add column if not exists image_url text,
  add column if not exists images_json jsonb not null default '[]'::jsonb,
  add column if not exists hire_status text not null default 'active'
    check (hire_status in ('active','unavailable','maintenance','archived')),
  add column if not exists default_daily_rate_cents integer not null default 0,
  add column if not exists half_day_rate_cents integer,
  add column if not exists hourly_rate_cents integer,
  add column if not exists weekend_rate_cents integer,
  add column if not exists public_holiday_rate_cents integer,
  add column if not exists bond_cents integer not null default 0,
  add column if not exists included_km integer,
  add column if not exists excess_km_rate_cents integer,
  add column if not exists cleaning_fee_cents integer not null default 0,
  add column if not exists late_return_rate_cents integer,
  add column if not exists min_hire_days integer not null default 1,
  add column if not exists max_hire_days integer,
  add column if not exists default_duration_minutes integer not null default 1435,
  add column if not exists prep_buffer_minutes integer not null default 0,
  add column if not exists cleanup_buffer_minutes integer not null default 0,
  add column if not exists pickup_times_json jsonb not null default '[]'::jsonb,
  add column if not exists return_times_json jsonb not null default '[]'::jsonb,
  add column if not exists licence_class text not null default '',
  add column if not exists carrying_capacity text not null default '',
  add column if not exists transmission text not null default '',
  add column if not exists odometer_km integer,
  add column if not exists fuel_level text not null default '',
  add column if not exists registration_expires_on date,
  add column if not exists insurance_expires_on date,
  add column if not exists service_due_on date,
  add column if not exists current_location text not null default '',
  add column if not exists agreement_template_id uuid,
  add column if not exists required_documents_json jsonb not null default '[]'::jsonb,
  add column if not exists hire_meta jsonb not null default '{}'::jsonb;

create unique index if not exists booking_resources_slug_uidx
  on booking_resources (booking_system_id, slug)
  where slug is not null and slug <> '';

create index if not exists booking_resources_hire_status_idx
  on booking_resources (booking_system_id, hire_status)
  where hire_status <> 'archived';

-- ── Hire booking detail (1:1 with bookings) ──────────────────────────────────

create table if not exists booking_hire_details (
  id                          uuid primary key default gen_random_uuid(),
  booking_id                  uuid not null unique references bookings(id) on delete cascade,
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  resource_id                 uuid references booking_resources(id) on delete set null,
  duration_mode               text not null default 'single_block'
    check (duration_mode in ('single_block','multi_day','custom_return')),
  hire_days                   integer not null default 1 check (hire_days >= 1),
  chargeable_days             integer not null default 1 check (chargeable_days >= 1),
  default_duration_minutes    integer not null default 1435,
  pickup_at                   timestamptz not null,
  return_at                   timestamptz not null,
  locked                      boolean not null default true,
  unlocked_until              timestamptz,
  unlocked_by                 uuid,
  unlock_reason               text not null default '',
  calendar_drag_allowed       boolean not null default false,
  capacity_override           boolean not null default false,
  capacity_override_reason    text not null default '',
  capacity_override_by        uuid,
  capacity_override_at        timestamptz,
  capacity_previous           integer,
  daily_rate_cents            integer not null default 0,
  bond_cents                  integer not null default 0,
  pricing_snapshot_json       jsonb not null default '{}'::jsonb,
  driver_json                 jsonb not null default '{}'::jsonb,
  additional_drivers_json     jsonb not null default '[]'::jsonb,
  emergency_contact_json      jsonb not null default '{}'::jsonb,
  licence_image_url           text,
  billing_address_json        jsonb not null default '{}'::jsonb,
  delivery_option             text not null default 'pickup'
    check (delivery_option in ('pickup','delivery','both')),
  delivery_fee_cents          integer not null default 0,
  extras_json                 jsonb not null default '[]'::jsonb,
  agreement_status            text not null default 'none'
    check (agreement_status in (
      'none','pending','generated','sent','viewed','signed','superseded','declined'
    )),
  payment_authority_accepted  boolean not null default false,
  cancellation_policy_accepted boolean not null default false,
  card_on_file_status         text not null default 'none'
    check (card_on_file_status in (
      'none','setup_required','secured','requires_action','failed','removed'
    )),
  protected_starts_at         timestamptz,
  cancellation_fee_floor_cents integer not null default 0,
  cancellation_policy_version text not null default '',
  google_event_id             text,
  google_calendar_id          text,
  google_sync_status          text not null default 'none',
  google_sync_error           text not null default '',
  google_etag                 text,
  google_last_synced_at       timestamptz,
  xero_invoice_id             text,
  xero_invoice_number         text,
  xero_invoice_status         text not null default 'none',
  xero_online_invoice_url     text,
  meta                        jsonb not null default '{}'::jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  check (return_at > pickup_at)
);

create index if not exists booking_hire_details_resource_range_idx
  on booking_hire_details (resource_id, pickup_at, return_at);

create index if not exists booking_hire_details_system_idx
  on booking_hire_details (booking_system_id, pickup_at);

-- ── Reschedule / unlock audit ────────────────────────────────────────────────

create table if not exists booking_hire_reschedule_history (
  id                          uuid primary key default gen_random_uuid(),
  booking_id                  uuid not null references bookings(id) on delete cascade,
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  actor_user_id               uuid,
  actor_role                  text not null default 'staff',
  reason                      text not null default '',
  previous_pickup_at          timestamptz not null,
  previous_return_at          timestamptz not null,
  new_pickup_at               timestamptz not null,
  new_return_at               timestamptz not null,
  previous_total_cents        integer not null default 0,
  new_total_cents             integer not null default 0,
  previous_fee_floor_cents    integer not null default 0,
  new_fee_floor_cents         integer not null default 0,
  customer_acknowledged       boolean not null default false,
  meta                        jsonb not null default '{}'::jsonb,
  created_at                  timestamptz not null default now()
);

create table if not exists booking_hire_lock_events (
  id                          uuid primary key default gen_random_uuid(),
  booking_id                  uuid not null references bookings(id) on delete cascade,
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  action                      text not null
    check (action in ('lock','unlock','relock','drag_blocked','api_blocked','google_restore')),
  actor_user_id               uuid,
  reason                      text not null default '',
  previous_values             jsonb not null default '{}'::jsonb,
  new_values                  jsonb not null default '{}'::jsonb,
  created_at                  timestamptz not null default now()
);

create table if not exists booking_hire_capacity_overrides (
  id                          uuid primary key default gen_random_uuid(),
  booking_id                  uuid references bookings(id) on delete set null,
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  day_ymd                     date not null,
  previous_count              integer not null,
  max_capacity                integer not null,
  reason                      text not null,
  actor_user_id               uuid,
  created_at                  timestamptz not null default now()
);

-- ── Cancellation policy versions ─────────────────────────────────────────────

create table if not exists booking_cancellation_policies (
  id                          uuid primary key default gen_random_uuid(),
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  version                     text not null,
  name                        text not null default 'Default hire cancellation',
  active                      boolean not null default true,
  rules_json                  jsonb not null default '[]'::jsonb,
  -- Example rules_json:
  -- [
  --   {"id":"gt_48h","min_hours_before":48,"fee_type":"none"},
  --   {"id":"24_to_48","min_hours_before":24,"max_hours_before":48,"fee_type":"fixed","fee_cents":5000},
  --   {"id":"lt_24","max_hours_before":24,"fee_type":"retain_rental"}
  -- ]
  created_at                  timestamptz not null default now(),
  unique (booking_system_id, version)
);

create table if not exists booking_cancellation_calculations (
  id                          uuid primary key default gen_random_uuid(),
  booking_id                  uuid not null references bookings(id) on delete cascade,
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  policy_version              text not null,
  calculated_at               timestamptz not null default now(),
  hours_before_protected      numeric(12,4) not null,
  rule_id                     text not null default '',
  rental_retained_cents       integer not null default 0,
  cancellation_fee_cents      integer not null default 0,
  bond_refund_cents           integer not null default 0,
  extras_refund_cents         integer not null default 0,
  refund_cents                integer not null default 0,
  amount_due_cents            integer not null default 0,
  fee_floor_applied_cents     integer not null default 0,
  breakdown_json              jsonb not null default '{}'::jsonb,
  actor_user_id               uuid,
  customer_confirmed          boolean not null default false,
  applied                     boolean not null default false
);

-- ── Stored payment methods (provider tokens only) ────────────────────────────

create table if not exists booking_payment_methods (
  id                          uuid primary key default gen_random_uuid(),
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  customer_id                 uuid references booking_customers(id) on delete set null,
  booking_id                  uuid references bookings(id) on delete set null,
  provider                    text not null default 'stripe'
    check (provider in ('stripe','square')),
  provider_customer_id        text not null,
  provider_payment_method_id  text not null,
  brand                       text not null default '',
  last4                       text not null default '',
  exp_month                   integer,
  exp_year                    integer,
  funding                     text not null default 'unknown'
    check (funding in ('credit','debit','prepaid','unknown')),
  country                     text not null default '',
  fingerprint                 text not null default '',
  is_default                  boolean not null default true,
  provider_status             text not null default 'active',
  consent_at                  timestamptz,
  consent_text_version        text not null default '',
  consent_text                text not null default '',
  consent_ip                  text not null default '',
  consent_user_agent          text not null default '',
  meta                        jsonb not null default '{}'::jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (booking_system_id, provider, provider_payment_method_id)
);

create index if not exists booking_payment_methods_customer_idx
  on booking_payment_methods (customer_id) where customer_id is not null;

-- ── Google connection (Calendar + Contacts) ──────────────────────────────────

create table if not exists booking_google_connections (
  id                          uuid primary key default gen_random_uuid(),
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  google_account_email        text not null default '',
  google_account_id           text not null default '',
  refresh_token_enc           text not null default '',
  access_token_enc            text not null default '',
  access_token_expires_at     timestamptz,
  scopes                      text[] not null default '{}',
  calendar_enabled            boolean not null default false,
  contacts_enabled            boolean not null default false,
  primary_calendar_id         text not null default 'primary',
  calendar_authority          text not null default 'leadpages'
    check (calendar_authority in ('leadpages','two_way_approval','google_allowed')),
  contacts_direction          text not null default 'leadpages_to_google'
    check (contacts_direction in (
      'disabled','leadpages_to_google','google_to_leadpages','two_way'
    )),
  sync_interval_minutes       integer not null default 15
    check (sync_interval_minutes in (5,15,30,60)),
  event_title_template        text not null default '{resource_name} — {customer_name} — {booking_reference}',
  last_successful_sync_at     timestamptz,
  last_attempted_sync_at      timestamptz,
  last_error                  text not null default '',
  sync_health                 text not null default 'unknown'
    check (sync_health in ('unknown','healthy','degraded','error','disconnected')),
  channel_id                  text,
  channel_resource_id         text,
  channel_expires_at          timestamptz,
  sync_token                  text,
  connected_by                uuid,
  connected_at                timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (booking_system_id)
);

create table if not exists booking_google_event_links (
  id                          uuid primary key default gen_random_uuid(),
  booking_id                  uuid not null references bookings(id) on delete cascade,
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  google_calendar_id          text not null,
  google_event_id             text not null,
  etag                        text not null default '',
  fingerprint                 text not null default '',
  sync_version                integer not null default 1,
  last_leadpages_modified_at  timestamptz,
  last_google_modified_at     timestamptz,
  last_successful_sync_at     timestamptz,
  last_attempted_sync_at      timestamptz,
  sync_status                 text not null default 'pending'
    check (sync_status in (
      'pending','synced','conflict','restored','error','deleted_remote','cancelled_local'
    )),
  sync_error                  text not null default '',
  managed                     boolean not null default true,
  meta                        jsonb not null default '{}'::jsonb,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (booking_id),
  unique (booking_system_id, google_calendar_id, google_event_id)
);

create table if not exists booking_google_sync_conflicts (
  id                          uuid primary key default gen_random_uuid(),
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  booking_id                  uuid references bookings(id) on delete set null,
  google_event_id             text not null default '',
  conflict_type               text not null default 'external_edit',
  leadpages_snapshot          jsonb not null default '{}'::jsonb,
  google_snapshot             jsonb not null default '{}'::jsonb,
  status                      text not null default 'open'
    check (status in ('open','restored','approved','rejected','ignored')),
  resolution_note             text not null default '',
  resolved_by                 uuid,
  resolved_at                 timestamptz,
  created_at                  timestamptz not null default now()
);

create table if not exists booking_google_contact_links (
  id                          uuid primary key default gen_random_uuid(),
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  customer_id                 uuid not null references booking_customers(id) on delete cascade,
  google_resource_name        text not null,
  etag                        text not null default '',
  last_synced_at              timestamptz,
  sync_status                 text not null default 'synced',
  meta                        jsonb not null default '{}'::jsonb,
  created_at                  timestamptz not null default now(),
  unique (customer_id),
  unique (booking_system_id, google_resource_name)
);

-- ── Xero connection ──────────────────────────────────────────────────────────

create table if not exists booking_xero_connections (
  id                          uuid primary key default gen_random_uuid(),
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  tenant_id                   text not null default '',
  tenant_name                 text not null default '',
  refresh_token_enc           text not null default '',
  access_token_enc            text not null default '',
  access_token_expires_at     timestamptz,
  scopes                      text[] not null default '{}',
  revenue_account_code        text not null default '',
  deposit_account_code        text not null default '',
  bond_account_code           text not null default '',
  cancellation_account_code   text not null default '',
  cleaning_account_code       text not null default '',
  payment_account_code        text not null default '',
  tax_type                    text not null default 'OUTPUT',
  default_invoice_status      text not null default 'AUTHORISED',
  branding_theme_id           text not null default '',
  invoice_due_days            integer not null default 7,
  auto_create_on              text not null default 'confirmed'
    check (auto_create_on in (
      'none','created','confirmed','agreement_accepted','deposit_due',
      'starts','completed','cancellation_fee','manual'
    )),
  auto_send                   boolean not null default false,
  attach_agreement            boolean not null default false,
  contact_conflict_mode       text not null default 'ask'
    check (contact_conflict_mode in ('leadpages','xero','ask')),
  last_successful_sync_at     timestamptz,
  last_attempted_sync_at      timestamptz,
  last_error                  text not null default '',
  sync_health                 text not null default 'unknown'
    check (sync_health in ('unknown','healthy','degraded','error','disconnected')),
  connected_by                uuid,
  connected_at                timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (booking_system_id)
);

create table if not exists booking_xero_contact_links (
  id                          uuid primary key default gen_random_uuid(),
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  customer_id                 uuid not null references booking_customers(id) on delete cascade,
  xero_contact_id             text not null,
  last_synced_at              timestamptz,
  sync_status                 text not null default 'synced',
  meta                        jsonb not null default '{}'::jsonb,
  created_at                  timestamptz not null default now(),
  unique (customer_id),
  unique (booking_system_id, xero_contact_id)
);

create table if not exists booking_xero_invoices (
  id                          uuid primary key default gen_random_uuid(),
  booking_id                  uuid not null references bookings(id) on delete cascade,
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  xero_tenant_id              text not null default '',
  xero_contact_id             text not null default '',
  xero_invoice_id             text not null,
  invoice_number              text not null default '',
  invoice_status              text not null default 'DRAFT',
  amount_due_cents            integer not null default 0,
  amount_paid_cents           integer not null default 0,
  due_date                    date,
  online_invoice_url          text,
  idempotency_key             text not null,
  line_items_json             jsonb not null default '[]'::jsonb,
  last_synced_at              timestamptz,
  sync_error                  text not null default '',
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (booking_system_id, xero_invoice_id),
  unique (booking_system_id, idempotency_key)
);

create table if not exists booking_xero_payments (
  id                          uuid primary key default gen_random_uuid(),
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  booking_id                  uuid references bookings(id) on delete set null,
  booking_payment_id          uuid references booking_payments(id) on delete set null,
  xero_invoice_id             text not null default '',
  xero_payment_id             text not null,
  amount_cents                integer not null default 0,
  idempotency_key             text not null,
  last_synced_at              timestamptz,
  created_at                  timestamptz not null default now(),
  unique (booking_system_id, xero_payment_id),
  unique (booking_system_id, idempotency_key)
);

-- ── Rental agreements ────────────────────────────────────────────────────────

create table if not exists booking_agreement_templates (
  id                          uuid primary key default gen_random_uuid(),
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  name                        text not null,
  template_version            text not null default '1',
  body_html                   text not null default '',
  merge_fields_json           jsonb not null default '[]'::jsonb,
  active                      boolean not null default true,
  created_by                  uuid,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create table if not exists booking_agreement_versions (
  id                          uuid primary key default gen_random_uuid(),
  booking_id                  uuid not null references bookings(id) on delete cascade,
  booking_system_id           uuid not null references booking_systems(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete cascade,
  template_id                 uuid references booking_agreement_templates(id) on delete set null,
  template_version            text not null default '',
  version_number              integer not null default 1,
  status                      text not null default 'generated'
    check (status in (
      'generated','sent','viewed','signed','superseded','declined'
    )),
  html_snapshot               text not null default '',
  pdf_url                     text,
  merge_data_json             jsonb not null default '{}'::jsonb,
  generated_by                uuid,
  generated_at                timestamptz not null default now(),
  signed_at                   timestamptz,
  signed_by_name              text not null default '',
  signature_audit_json        jsonb not null default '{}'::jsonb,
  uploaded_signed_url         text,
  unique (booking_id, version_number)
);

-- Link agreement_template_id FK now that templates exist
do $$ begin
  alter table booking_resources
    drop constraint if exists booking_resources_agreement_template_id_fkey;
  alter table booking_resources
    add constraint booking_resources_agreement_template_id_fkey
    foreign key (agreement_template_id) references booking_agreement_templates(id) on delete set null;
exception when others then null;
end $$;

-- ── Customer Stripe customer id (card-on-file) ───────────────────────────────
alter table booking_customers
  add column if not exists stripe_customer_id text;

create index if not exists booking_customers_stripe_customer_idx
  on booking_customers (stripe_customer_id)
  where stripe_customer_id is not null and stripe_customer_id <> '';

-- ── Default hire settings seed helper (applied in app code) ──────────────────
comment on table booking_hire_details is
  'Vehicle/equipment hire extensions for a bookings row. Leadpages booking remains authoritative.';

comment on table booking_google_connections is
  'Per-system Google OAuth for Calendar and Contacts. Tokens encrypted at rest.';

comment on table booking_xero_connections is
  'Per-system Xero OAuth. Tokens encrypted at rest. Xero is accounting authority only.';
