-- db/bookings_schema.sql
-- LeadPages Bookings — appointments, classes, on-site visits, resource hire.
-- Run once in Supabase SQL editor. Pair with db/bookings_rls.sql.
-- Money: integer cents. Times: timestamptz (UTC) + timezone on booking_systems.
-- Namespace: booking_* (distinct from order_*, domain_orders, bookingCta section config).

-- ── Per-site booking system ──────────────────────────────────────────────────

create table if not exists booking_systems (
  id                          uuid primary key default gen_random_uuid(),
  site_id                     uuid not null references sites(id) on delete cascade,
  enabled                     boolean not null default false,
  onboarding_step             text not null default 'types'
    check (onboarding_step in (
      'types','details','service','availability','team','payments','comms','publish','done'
    )),
  booking_types               text[] not null default array['appointment']::text[],
  timezone                    text not null default 'Australia/Sydney',
  currency                    text not null default 'AUD',
  locale                      text not null default 'en-AU',
  gst_mode                    text not null default 'inclusive'
    check (gst_mode in ('inclusive','exclusive','none')),
  gst_rate_bps                integer not null default 1000, -- 10%
  business_name               text not null default '',
  phone                       text not null default '',
  email                       text not null default '',
  abn                         text not null default '',
  address_json                jsonb not null default '{}'::jsonb,
  logo_url                    text,
  -- Payments
  payment_rule                text not null default 'none'
    check (payment_rule in (
      'none','full_payment','fixed_deposit','percentage_deposit','card_guarantee','pay_later','quote_required'
    )),
  deposit_amount_cents        integer not null default 0,
  deposit_percent_bps         integer not null default 0,
  stripe_connect_account_id   text,
  -- Booking rules
  min_notice_minutes          integer not null default 60,
  max_advance_days            integer not null default 90,
  hold_minutes                integer not null default 10,
  slot_interval_minutes       integer not null default 15,
  cancellation_hours          integer not null default 24,
  reschedule_hours            integer not null default 24,
  -- Comms defaults
  send_confirmation           boolean not null default true,
  send_reminder_24h           boolean not null default true,
  notify_assigned_staff       boolean not null default true,
  send_cancellation           boolean not null default true,
  -- Public
  public_slug                 text,
  settings                    jsonb not null default '{}'::jsonb,
  next_booking_seq            integer not null default 1,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (site_id)
);

create index if not exists booking_systems_site_id_idx on booking_systems(site_id);
create unique index if not exists booking_systems_public_slug_uidx
  on booking_systems (public_slug) where public_slug is not null and public_slug <> '';

comment on table booking_systems is
  'Per-site Bookings app binding, onboarding state, and business defaults.';

-- ── Categories & services ────────────────────────────────────────────────────

create table if not exists booking_service_categories (
  id                  uuid primary key default gen_random_uuid(),
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  name                text not null,
  slug                text not null,
  description         text not null default '',
  sort_order          integer not null default 0,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (booking_system_id, slug)
);

create table if not exists booking_services (
  id                  uuid primary key default gen_random_uuid(),
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  category_id         uuid references booking_service_categories(id) on delete set null,
  name                text not null,
  internal_name       text not null default '',
  slug                text not null,
  description         text not null default '',
  short_description   text not null default '',
  image_url           text,
  booking_type        text not null default 'appointment'
    check (booking_type in ('appointment','class','event','onsite','resource_hire','consultation')),
  duration_minutes    integer not null default 60 check (duration_minutes > 0),
  prep_minutes        integer not null default 0 check (prep_minutes >= 0),
  cleanup_minutes     integer not null default 0 check (cleanup_minutes >= 0),
  travel_buffer_minutes integer not null default 0 check (travel_buffer_minutes >= 0),
  price_model         text not null default 'fixed'
    check (price_model in (
      'fixed','from','per_hour','per_person','per_day','variable','free','quote_required'
    )),
  price_cents         integer not null default 0,
  gst_treatment       text not null default 'inherit'
    check (gst_treatment in ('inherit','inclusive','exclusive','none')),
  deposit_rule        text, -- null = inherit system
  deposit_amount_cents integer,
  deposit_percent_bps  integer,
  capacity            integer not null default 1 check (capacity >= 1),
  min_capacity        integer not null default 1 check (min_capacity >= 1),
  delivery_mode       text not null default 'at_business'
    check (delivery_mode in ('at_business','at_customer','online','phone','venue')),
  location_label      text not null default '',
  customer_instructions text not null default '',
  confirmation_instructions text not null default '',
  colour              text not null default '#155c4a',
  min_notice_minutes  integer,
  max_advance_days    integer,
  cancellation_hours  integer,
  reschedule_hours    integer,
  visibility          text not null default 'public'
    check (visibility in ('public','unlisted','private')),
  status              text not null default 'active'
    check (status in ('active','draft','archived')),
  sort_order          integer not null default 0,
  settings            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (booking_system_id, slug)
);

create index if not exists booking_services_system_idx
  on booking_services(booking_system_id, sort_order) where status <> 'archived';

create table if not exists booking_service_addons (
  id                  uuid primary key default gen_random_uuid(),
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  service_id          uuid not null references booking_services(id) on delete cascade,
  name                text not null,
  addon_type          text not null default 'checkbox'
    check (addon_type in ('checkbox','quantity','single_choice','multi_choice')),
  price_cents         integer not null default 0,
  duration_delta_minutes integer not null default 0,
  capacity_delta      integer not null default 0,
  options_json        jsonb not null default '[]'::jsonb,
  required            boolean not null default false,
  sort_order          integer not null default 0,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── Team & resources ─────────────────────────────────────────────────────────

create table if not exists booking_team_members (
  id                  uuid primary key default gen_random_uuid(),
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  display_name        text not null,
  job_title           text not null default '',
  bio                 text not null default '',
  photo_url           text,
  email               text not null default '',
  phone               text not null default '',
  linked_user_id      uuid references profiles(id) on delete set null,
  colour              text not null default '#2563eb',
  public_visible      boolean not null default true,
  active              boolean not null default true,
  settings            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists booking_team_system_idx
  on booking_team_members(booking_system_id) where active = true;

create table if not exists booking_staff_services (
  id                  uuid primary key default gen_random_uuid(),
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  team_member_id      uuid not null references booking_team_members(id) on delete cascade,
  service_id          uuid not null references booking_services(id) on delete cascade,
  unique (team_member_id, service_id)
);

create table if not exists booking_resources (
  id                  uuid primary key default gen_random_uuid(),
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  name                text not null,
  resource_type       text not null default 'room'
    check (resource_type in (
      'room','vehicle','equipment','chair','cart','machine','station','venue','other'
    )),
  description         text not null default '',
  location_label      text not null default '',
  quantity            integer not null default 1 check (quantity >= 1),
  prep_minutes        integer not null default 0,
  cleanup_minutes     integer not null default 0,
  active              boolean not null default true,
  settings            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists booking_service_resources (
  id                  uuid primary key default gen_random_uuid(),
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  service_id          uuid not null references booking_services(id) on delete cascade,
  resource_id         uuid not null references booking_resources(id) on delete cascade,
  quantity_required   integer not null default 1 check (quantity_required >= 1),
  mandatory           boolean not null default true,
  unique (service_id, resource_id)
);

-- ── Availability ─────────────────────────────────────────────────────────────

-- weekday: 0=Sunday .. 6=Saturday (JS Date.getDay)
create table if not exists booking_availability_rules (
  id                  uuid primary key default gen_random_uuid(),
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  scope               text not null default 'business'
    check (scope in ('business','service','team','resource')),
  scope_id            uuid, -- null for business; else service/team/resource id
  weekday             integer not null check (weekday between 0 and 6),
  start_time          time not null,
  end_time            time not null,
  is_break            boolean not null default false,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists booking_availability_scope_idx
  on booking_availability_rules(booking_system_id, scope, scope_id, weekday);

create table if not exists booking_schedule_exceptions (
  id                  uuid primary key default gen_random_uuid(),
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  scope               text not null default 'business'
    check (scope in ('business','service','team','resource')),
  scope_id            uuid,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  kind                text not null default 'closed'
    check (kind in ('closed','open_override','leave','maintenance','block')),
  title               text not null default '',
  created_at          timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists booking_exceptions_range_idx
  on booking_schedule_exceptions(booking_system_id, starts_at, ends_at);

-- ── Customers ────────────────────────────────────────────────────────────────

create table if not exists booking_customers (
  id                  uuid primary key default gen_random_uuid(),
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  name                text not null,
  email               text not null default '',
  email_norm          text not null default '',
  phone               text not null default '',
  phone_e164          text not null default '',
  address_json        jsonb not null default '{}'::jsonb,
  notes               text not null default '',
  tags                text[] not null default '{}',
  marketing_consent   boolean not null default false,
  preferred_team_member_id uuid references booking_team_members(id) on delete set null,
  lifetime_value_cents integer not null default 0,
  booking_count       integer not null default 0,
  no_show_count       integer not null default 0,
  cancel_count        integer not null default 0,
  last_activity_at    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists booking_customers_email_idx
  on booking_customers(booking_system_id, email_norm) where email_norm <> '';
create index if not exists booking_customers_phone_idx
  on booking_customers(booking_system_id, phone_e164) where phone_e164 <> '';

-- ── Bookings ─────────────────────────────────────────────────────────────────

create table if not exists bookings (
  id                  uuid primary key default gen_random_uuid(),
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  reference           text not null,
  service_id          uuid not null references booking_services(id),
  customer_id         uuid references booking_customers(id) on delete set null,
  team_member_id      uuid references booking_team_members(id) on delete set null,
  booking_type        text not null default 'appointment',
  status              text not null default 'pending'
    check (status in (
      'draft','pending','confirmed','checked_in','in_progress','completed',
      'cancelled','no_show','awaiting_payment','refunded'
    )),
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  timezone            text not null default 'Australia/Sydney',
  attendee_count      integer not null default 1,
  location_label      text not null default '',
  delivery_mode       text not null default 'at_business',
  customer_address_json jsonb not null default '{}'::jsonb,
  source              text not null default 'admin'
    check (source in ('admin','public','portal','import','api','waitlist')),
  idempotency_key     text,
  hold_expires_at     timestamptz,
  -- Money snapshot (cents)
  subtotal_cents      integer not null default 0,
  addons_cents        integer not null default 0,
  discount_cents      integer not null default 0,
  travel_fee_cents    integer not null default 0,
  gst_cents           integer not null default 0,
  total_cents         integer not null default 0,
  deposit_cents       integer not null default 0,
  amount_paid_cents   integer not null default 0,
  amount_refunded_cents integer not null default 0,
  payment_status      text not null default 'none'
    check (payment_status in (
      'none','unpaid','deposit_paid','paid','partially_refunded','refunded','failed'
    )),
  customer_name       text not null default '',
  customer_email      text not null default '',
  customer_phone      text not null default '',
  internal_notes      text not null default '',
  customer_notes      text not null default '',
  labels              text[] not null default '{}',
  addon_selections    jsonb not null default '[]'::jsonb,
  form_responses      jsonb not null default '{}'::jsonb,
  meeting_url         text,
  cancelled_at        timestamptz,
  cancel_reason       text,
  version             integer not null default 1,
  created_by          uuid,
  updated_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (booking_system_id, reference)
);

create unique index if not exists bookings_idempotency_uidx
  on bookings(booking_system_id, idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

create index if not exists bookings_range_idx
  on bookings(booking_system_id, starts_at, ends_at)
  where status not in ('cancelled','draft');

create index if not exists bookings_team_range_idx
  on bookings(team_member_id, starts_at, ends_at)
  where team_member_id is not null and status not in ('cancelled','draft');

create index if not exists bookings_status_idx
  on bookings(booking_system_id, status, starts_at);

create table if not exists booking_attendees (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references bookings(id) on delete cascade,
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  name                text not null default '',
  email               text not null default '',
  phone               text not null default '',
  responses_json      jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create table if not exists booking_resources_reserved (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references bookings(id) on delete cascade,
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  resource_id         uuid not null references booking_resources(id) on delete cascade,
  quantity            integer not null default 1,
  unique (booking_id, resource_id)
);

create table if not exists booking_status_history (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references bookings(id) on delete cascade,
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  from_status         text,
  to_status           text not null,
  actor_user_id       uuid,
  reason              text not null default '',
  created_at          timestamptz not null default now()
);

create table if not exists booking_activity (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid references bookings(id) on delete cascade,
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  event_type          text not null,
  summary             text not null default '',
  meta                jsonb not null default '{}'::jsonb,
  actor_user_id       uuid,
  created_at          timestamptz not null default now()
);

create index if not exists booking_activity_system_idx
  on booking_activity(booking_system_id, created_at desc);

create table if not exists booking_holds (
  id                  uuid primary key default gen_random_uuid(),
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  service_id          uuid not null references booking_services(id) on delete cascade,
  team_member_id      uuid references booking_team_members(id) on delete set null,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  expires_at          timestamptz not null,
  hold_key            text not null,
  meta                jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  unique (booking_system_id, hold_key)
);

create index if not exists booking_holds_range_idx
  on booking_holds(booking_system_id, starts_at, ends_at, expires_at);

create table if not exists booking_payments (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references bookings(id) on delete cascade,
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  provider            text not null default 'stripe'
    check (provider in ('stripe','manual','eft','in_person','square')),
  kind                text not null default 'deposit'
    check (kind in ('deposit','balance','full','refund','fee')),
  amount_cents        integer not null,
  currency            text not null default 'AUD',
  status              text not null default 'pending'
    check (status in ('pending','succeeded','failed','cancelled','refunded')),
  provider_ref        text,
  idempotency_key     text,
  meta                jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists booking_payments_idempotency_uidx
  on booking_payments(booking_system_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists booking_portal_tokens (
  id                  uuid primary key default gen_random_uuid(),
  booking_system_id   uuid not null references booking_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  booking_id          uuid not null references bookings(id) on delete cascade,
  token_hash          text not null unique,
  purpose             text not null default 'manage'
    check (purpose in ('manage','pay','form','reschedule')),
  expires_at          timestamptz not null,
  revoked_at          timestamptz,
  used_at             timestamptz,
  created_at          timestamptz not null default now()
);

create table if not exists booking_audit_events (
  id                  uuid primary key default gen_random_uuid(),
  booking_system_id   uuid references booking_systems(id) on delete set null,
  site_id             uuid references sites(id) on delete set null,
  actor_user_id       uuid,
  action              text not null,
  entity_type         text not null default '',
  entity_id           uuid,
  summary             text not null default '',
  meta                jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists booking_audit_site_idx
  on booking_audit_events(site_id, created_at desc);

-- ── Waitlist ─────────────────────────────────────────────────────────────────

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

-- ── Notification outbox ──────────────────────────────────────────────────────

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

