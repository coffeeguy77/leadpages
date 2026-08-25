-- db/order_engine_schema.sql
-- LeadPages Universal Ordering System / Order Engine
-- Industry-agnostic commerce orders (butcher first preset, not butcher-only).
-- Run once in Supabase SQL editor. Pair with db/order_engine_rls.sql.
--
-- Money: integer cents. Weight: numeric kg. Times: timestamptz (UTC) + business timezone on settings.
-- Namespace: order_* (distinct from domain_orders / partner_quotes / quote_systems).

-- ── Per-site order system binding + settings ─────────────────────────────────

create table if not exists order_systems (
  id                          uuid primary key default gen_random_uuid(),
  site_id                     uuid not null references sites(id) on delete cascade,
  enabled                     boolean not null default false,
  industry_preset             text not null default 'custom',
  order_prefix                text not null default 'ORD',
  timezone                    text not null default 'Australia/Sydney',
  currency                    text not null default 'AUD',
  -- Fulfilment
  pickup_enabled              boolean not null default true,
  delivery_enabled            boolean not null default false,
  -- Customer editing
  customer_editing_enabled    boolean not null default true,
  change_mode                 text not null default 'automatic'
    check (change_mode in ('automatic', 'approval_required')),
  -- Default cutoff: days/hours before pickup at a wall-clock time
  default_cutoff_mode         text not null default 'days_before'
    check (default_cutoff_mode in ('none', 'hours_before', 'days_before', 'weekday_rule')),
  default_cutoff_value        integer not null default 3,
  default_cutoff_time         time not null default '17:00',
  default_cutoff_weekday      integer, -- 0=Sun .. 6=Sat when weekday_rule
  -- Payments (business default; overridable per category/product/order)
  payment_rule                text not null default 'fixed_deposit'
    check (payment_rule in (
      'none', 'fixed_deposit', 'percentage_deposit', 'full_payment', 'pay_later', 'quote_first'
    )),
  deposit_amount_cents        integer not null default 5000,
  deposit_percent_bps         integer not null default 0, -- basis points, e.g. 3000 = 30%
  deposit_scope               text not null default 'per_order'
    check (deposit_scope in ('per_order', 'per_item')),
  balance_settlement          text not null default 'at_pickup'
    check (balance_settlement in (
      'online_before_pickup', 'at_pickup', 'on_delivery', 'invoice', 'none'
    )),
  -- Stock defaults
  default_stock_method        text not null default 'unlimited'
    check (default_stock_method in (
      'unlimited', 'stock_controlled', 'made_to_order', 'limited_allocation', 'preorder'
    )),
  -- Cart recovery
  abandoned_cart_enabled      boolean not null default true,
  abandoned_cart_delay_minutes integer not null default 60,
  abandoned_cart_channels     text[] not null default array['email']::text[],
  -- Storefront
  storefront_display_mode     text not null default 'image_cards'
    check (storefront_display_mode in (
      'image_cards', 'compact_cards', 'product_list', 'catalogue_grid', 'quick_order_table'
    )),
  cross_sell_heading          text not null default 'You Might Also Like',
  -- Capacity (optional)
  capacity_enabled            boolean not null default false,
  capacity_per_day            integer,
  -- Misc
  settings                    jsonb not null default '{}'::jsonb,
  next_order_seq              integer not null default 1,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (site_id)
);

comment on table order_systems is
  'Per-site Order Engine binding and business defaults. Presets seed defaults only.';

create index if not exists order_systems_site_id_idx on order_systems(site_id);

-- ── Categories ───────────────────────────────────────────────────────────────

create table if not exists order_categories (
  id                uuid primary key default gen_random_uuid(),
  order_system_id   uuid not null references order_systems(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  name              text not null,
  slug              text not null,
  description       text,
  sort_order        integer not null default 0,
  active            boolean not null default true,
  payment_rule      text, -- null = inherit business
  deposit_amount_cents integer,
  deposit_percent_bps  integer,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (order_system_id, slug)
);

create index if not exists order_categories_system_idx
  on order_categories(order_system_id, sort_order);

-- ── Products ─────────────────────────────────────────────────────────────────

create table if not exists order_products (
  id                uuid primary key default gen_random_uuid(),
  order_system_id   uuid not null references order_systems(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  category_id       uuid references order_categories(id) on delete set null,
  name              text not null,
  slug              text not null,
  description       text,
  short_description text,
  sku               text,
  image_url         text,
  gallery           jsonb not null default '[]'::jsonb,
  tags              text[] not null default '{}',
  active            boolean not null default true,
  featured          boolean not null default false,
  sort_order        integer not null default 0,
  -- Pricing method (modular — never force a price for price_tbc)
  pricing_method    text not null default 'fixed'
    check (pricing_method in (
      'fixed', 'per_unit', 'per_weight', 'estimated', 'from_price', 'price_tbc', 'quote_required'
    )),
  price_cents       integer,          -- fixed / per_unit / from / estimated display
  price_per_kg_cents integer,         -- per_weight rate
  price_label       text,             -- optional display override
  -- Stock behaviour
  stock_method      text not null default 'unlimited'
    check (stock_method in (
      'unlimited', 'stock_controlled', 'made_to_order', 'limited_allocation', 'preorder'
    )),
  stock_qty         numeric(14,4),
  stock_low_threshold numeric(14,4),
  allow_backorder   boolean not null default false,
  max_per_order     numeric(14,4),
  allocation_qty    numeric(14,4),
  preorder_release_at timestamptz,
  -- Cutoff (product-specific; null mode = use store default)
  cutoff_mode       text not null default 'store_default'
    check (cutoff_mode in (
      'store_default', 'none', 'hours_before', 'days_before', 'specific_datetime'
    )),
  cutoff_value      integer,
  cutoff_at         timestamptz,
  -- Lead time (separate from cutoff)
  lead_time_mode    text not null default 'none'
    check (lead_time_mode in ('none', 'hours', 'days')),
  lead_time_value   integer not null default 0,
  -- Payment override (null = inherit category → business)
  payment_rule      text,
  deposit_amount_cents integer,
  deposit_percent_bps  integer,
  -- Options / metadata
  unit_label        text,             -- e.g. steak, kg, bottle
  weight_required   boolean not null default false,
  options           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (order_system_id, slug)
);

comment on table order_products is
  'Flexible products. Pricing, stock, cutoff, lead time and payment are independent dimensions.';

create index if not exists order_products_system_idx
  on order_products(order_system_id, active, sort_order);
create index if not exists order_products_category_idx
  on order_products(category_id);
create index if not exists order_products_site_name_idx
  on order_products(site_id, name);

-- ── Product questions ────────────────────────────────────────────────────────

create table if not exists order_product_questions (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references order_products(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  key               text not null,
  label             text not null,
  field_type        text not null
    check (field_type in (
      'short_text', 'long_text', 'number', 'dropdown', 'radio', 'checkboxes',
      'date', 'file', 'yes_no', 'weight'
    )),
  required          boolean not null default false,
  options           jsonb not null default '[]'::jsonb,
  sort_order        integer not null default 0,
  staff_only        boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (product_id, key)
);

-- ── Product relationships (cross-sell) ───────────────────────────────────────

create table if not exists order_product_relationships (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references order_products(id) on delete cascade,
  related_product_id uuid not null references order_products(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  relationship_type text not null
    check (relationship_type in (
      'pairs_well_with', 'frequently_bought_with', 'required_addon',
      'optional_addon', 'alternative', 'upgrade'
    )),
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  unique (product_id, related_product_id, relationship_type),
  check (product_id <> related_product_id)
);

-- ── Customers (lightweight CRM) ──────────────────────────────────────────────

create table if not exists order_customers (
  id                uuid primary key default gen_random_uuid(),
  order_system_id   uuid not null references order_systems(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  name              text not null,
  phone             text,
  email             text,
  address_line1     text,
  address_line2     text,
  suburb            text,
  state             text,
  postcode          text,
  notes             text,
  order_count       integer not null default 0,
  lifetime_spend_cents integer not null default 0,
  last_order_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists order_customers_system_idx on order_customers(order_system_id);
create index if not exists order_customers_phone_idx on order_customers(site_id, phone);
create index if not exists order_customers_email_idx on order_customers(site_id, email);
create index if not exists order_customers_name_idx on order_customers(site_id, name);

-- ── Carts ────────────────────────────────────────────────────────────────────

create table if not exists order_carts (
  id                uuid primary key default gen_random_uuid(),
  order_system_id   uuid not null references order_systems(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  customer_id       uuid references order_customers(id) on delete set null,
  guest_name        text,
  guest_phone       text,
  guest_email       text,
  status            text not null default 'active'
    check (status in ('active', 'abandoned', 'recovered', 'converted', 'expired')),
  known_subtotal_cents integer not null default 0,
  has_unknown_prices boolean not null default false,
  item_count        integer not null default 0,
  recovery_state    jsonb not null default '{}'::jsonb,
  converted_order_id uuid,
  last_activity_at  timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists order_carts_system_status_idx
  on order_carts(order_system_id, status, last_activity_at desc);

create table if not exists order_cart_items (
  id                uuid primary key default gen_random_uuid(),
  cart_id           uuid not null references order_carts(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  product_id        uuid references order_products(id) on delete set null,
  product_snapshot  jsonb not null default '{}'::jsonb,
  quantity          numeric(14,4) not null default 1,
  requested_weight_kg numeric(14,4),
  unit_price_cents  integer,
  line_known_cents  integer,
  price_status      text not null default 'known'
    check (price_status in ('known', 'estimated', 'tbc', 'quote_required')),
  answers           jsonb not null default '{}'::jsonb,
  notes             text,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists order_cart_items_cart_idx on order_cart_items(cart_id);

-- ── Orders (permanent source of truth) ───────────────────────────────────────

create table if not exists order_orders (
  id                uuid primary key default gen_random_uuid(),
  order_system_id   uuid not null references order_systems(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  customer_id       uuid references order_customers(id) on delete set null,
  cart_id           uuid references order_carts(id) on delete set null,
  order_number      text not null,
  status            text not null default 'draft'
    check (status in (
      'draft', 'awaiting_deposit', 'confirmed', 'changes_open', 'locked',
      'in_preparation', 'ready', 'collected', 'completed', 'archived',
      'cancelled', 'refunded'
    )),
  source            text not null default 'staff'
    check (source in ('staff', 'phone', 'walk_in', 'online', 'reorder', 'system')),
  -- Customer snapshot at order time
  customer_name     text not null,
  customer_phone    text,
  customer_email    text,
  -- Fulfilment
  fulfilment_type   text not null default 'pickup'
    check (fulfilment_type in ('pickup', 'delivery')),
  pickup_date       date,
  pickup_time       time,
  pickup_window_start time,
  pickup_window_end time,
  pickup_location   text,
  delivery_address  jsonb,
  delivery_fee_cents integer not null default 0,
  -- Totals (cents) — known vs unknown prices
  known_subtotal_cents    integer not null default 0,
  estimated_subtotal_cents integer,
  final_subtotal_cents    integer,
  deposit_required_cents  integer not null default 0,
  deposit_paid_cents      integer not null default 0,
  balance_cents           integer,
  has_unknown_prices      boolean not null default false,
  price_status            text not null default 'partial'
    check (price_status in ('known', 'partial', 'tbc', 'finalised')),
  -- Cutoff / lock (deterministic audit trail)
  effective_cutoff_at     timestamptz,
  cutoff_reason           text,
  editing_state           text not null default 'open'
    check (editing_state in ('open', 'closing_soon', 'locked')),
  locked_at               timestamptz,
  locked_by               uuid references profiles(id) on delete set null,
  lock_source             text, -- system | admin | date_lock
  -- Notes
  customer_notes          text,
  internal_notes          text,
  -- Operations flags (Pickup Day View / run sheets / labels)
  is_important            boolean not null default false,
  important_meta          jsonb not null default '{}'::jsonb,
  -- Payment rule snapshot
  payment_rule_snapshot   jsonb not null default '{}'::jsonb,
  -- Meta
  created_by              uuid references profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  confirmed_at            timestamptz,
  ready_at                timestamptz,
  collected_at            timestamptz,
  completed_at            timestamptz,
  cancelled_at            timestamptz,
  unique (order_system_id, order_number)
);

comment on table order_orders is
  'Permanent order record — source of truth replacing paper triplicate + sheets.';

create index if not exists order_orders_system_status_idx
  on order_orders(order_system_id, status, created_at desc);
create index if not exists order_orders_pickup_idx
  on order_orders(order_system_id, pickup_date, status);
create index if not exists order_orders_customer_idx
  on order_orders(customer_id, created_at desc);
create index if not exists order_orders_number_idx
  on order_orders(order_number);
create index if not exists order_orders_phone_idx
  on order_orders(site_id, customer_phone);
create index if not exists order_orders_search_idx
  on order_orders(site_id, customer_name, customer_email);

-- ── Order items (with product snapshots) ─────────────────────────────────────

create table if not exists order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references order_orders(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  product_id        uuid references order_products(id) on delete set null,
  -- Snapshot fields (historical accuracy)
  product_name      text not null,
  product_sku       text,
  pricing_method    text not null,
  unit_label        text,
  quantity          numeric(14,4) not null default 1,
  requested_weight_kg numeric(14,4),
  actual_weight_kg  numeric(14,4),
  unit_price_cents  integer,          -- fixed/unit or per-kg rate
  line_known_cents  integer,          -- known portion at order time
  line_final_cents  integer,          -- after finalisation
  price_status      text not null default 'known'
    check (price_status in ('known', 'estimated', 'tbc', 'quote_required', 'finalised')),
  notes             text,
  options_snapshot  jsonb not null default '{}'::jsonb,
  product_snapshot  jsonb not null default '{}'::jsonb,
  sort_order        integer not null default 0,
  finalised_at      timestamptz,
  finalised_by      uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists order_items_order_idx on order_items(order_id, sort_order);
create index if not exists order_items_product_idx on order_items(product_id);
create index if not exists order_items_price_status_idx
  on order_items(site_id, price_status);

create table if not exists order_item_answers (
  id                uuid primary key default gen_random_uuid(),
  order_item_id     uuid not null references order_items(id) on delete cascade,
  question_key      text not null,
  question_label    text not null,
  field_type        text not null,
  value             jsonb not null default 'null'::jsonb,
  created_at        timestamptz not null default now(),
  unique (order_item_id, question_key)
);

-- ── Payments ─────────────────────────────────────────────────────────────────

create table if not exists order_payments (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references order_orders(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  kind              text not null
    check (kind in ('deposit', 'balance', 'full', 'refund', 'adjustment')),
  status            text not null default 'pending'
    check (status in ('pending', 'requires_action', 'paid', 'failed', 'cancelled', 'refunded')),
  amount_cents      integer not null,
  currency          text not null default 'AUD',
  provider          text not null default 'stripe',
  stripe_session_id text,
  stripe_payment_intent_id text,
  payment_link_url  text,
  paid_at           timestamptz,
  meta              jsonb not null default '{}'::jsonb,
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists order_payments_order_idx on order_payments(order_id, created_at desc);
create index if not exists order_payments_stripe_idx on order_payments(stripe_session_id);

-- ── Change audit + optional approval requests ────────────────────────────────

create table if not exists order_changes (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references order_orders(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  order_item_id     uuid references order_items(id) on delete set null,
  field_path        text not null,
  previous_value    jsonb,
  new_value         jsonb,
  source            text not null
    check (source in ('customer_portal', 'admin', 'staff', 'system')),
  actor_user_id     uuid references profiles(id) on delete set null,
  actor_label       text,
  note              text,
  created_at        timestamptz not null default now()
);

create index if not exists order_changes_order_idx on order_changes(order_id, created_at desc);

create table if not exists order_change_requests (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references order_orders(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  status            text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'cancelled')),
  proposed_changes  jsonb not null default '[]'::jsonb,
  customer_note     text,
  admin_note        text,
  decided_by        uuid references profiles(id) on delete set null,
  decided_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists order_change_requests_pending_idx
  on order_change_requests(site_id, status, created_at desc);

-- ── Customer magic-link access ───────────────────────────────────────────────

create table if not exists order_access_tokens (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references order_orders(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  token_hash        text not null unique,
  purpose           text not null default 'portal'
    check (purpose in ('portal', 'deposit', 'reorder')),
  expires_at        timestamptz not null,
  revoked_at        timestamptz,
  last_used_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists order_access_tokens_order_idx on order_access_tokens(order_id);

-- ── Messaging ────────────────────────────────────────────────────────────────

create table if not exists order_message_templates (
  id                uuid primary key default gen_random_uuid(),
  order_system_id   uuid not null references order_systems(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  category          text not null
    check (category in (
      'abandoned_cart', 'deposit_reminder', 'order_confirmed', 'changes_closing_soon',
      'order_locked', 'pickup_reminder', 'ready_for_collection', 'order_completed',
      'price_finalised', 'deposit_required', 'deposit_received', 'custom'
    )),
  name              text not null,
  channel           text not null default 'email'
    check (channel in ('email', 'sms', 'both')),
  subject           text,
  body              text not null,
  tone              text,
  industry          text,
  topic             text,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists order_message_templates_system_idx
  on order_message_templates(order_system_id, category);

create table if not exists order_messages (
  id                uuid primary key default gen_random_uuid(),
  order_system_id   uuid not null references order_systems(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  order_id          uuid references order_orders(id) on delete set null,
  cart_id           uuid references order_carts(id) on delete set null,
  customer_id       uuid references order_customers(id) on delete set null,
  channel           text not null check (channel in ('email', 'sms')),
  event_type        text not null,
  destination       text not null,
  subject           text,
  body              text not null,
  status            text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'clicked')),
  provider_id       text,
  meta              jsonb not null default '{}'::jsonb,
  sent_at           timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists order_messages_order_idx on order_messages(order_id, created_at desc);
create index if not exists order_messages_cart_idx on order_messages(cart_id, created_at desc);

create table if not exists order_abandoned_events (
  id                uuid primary key default gen_random_uuid(),
  cart_id           uuid not null references order_carts(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  stage             integer not null default 1,
  channel           text not null,
  message_id        uuid references order_messages(id) on delete set null,
  status            text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'skipped', 'converted')),
  scheduled_for     timestamptz not null,
  sent_at           timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists order_abandoned_events_due_idx
  on order_abandoned_events(status, scheduled_for);

-- ── Pickup windows / capacity ────────────────────────────────────────────────

create table if not exists order_fulfilment_windows (
  id                uuid primary key default gen_random_uuid(),
  order_system_id   uuid not null references order_systems(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  weekday           integer check (weekday between 0 and 6),
  specific_date     date,
  window_start      time not null,
  window_end        time not null,
  capacity          integer,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

create table if not exists order_date_locks (
  id                uuid primary key default gen_random_uuid(),
  order_system_id   uuid not null references order_systems(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  pickup_date       date not null,
  locked_at         timestamptz not null default now(),
  locked_by         uuid references profiles(id) on delete set null,
  note              text,
  unique (order_system_id, pickup_date)
);

-- ── Audit log ────────────────────────────────────────────────────────────────

create table if not exists order_audit_events (
  id                uuid primary key default gen_random_uuid(),
  order_system_id   uuid references order_systems(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  order_id          uuid references order_orders(id) on delete set null,
  cart_id           uuid references order_carts(id) on delete set null,
  event_type        text not null,
  actor_user_id     uuid references profiles(id) on delete set null,
  actor_label       text,
  source            text not null default 'system',
  payload           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists order_audit_events_order_idx
  on order_audit_events(order_id, created_at desc);
create index if not exists order_audit_events_site_idx
  on order_audit_events(site_id, created_at desc);

-- FK for cart → converted order (added after order_orders exists)
do $$ begin
  alter table order_carts
    add constraint order_carts_converted_order_fk
    foreign key (converted_order_id) references order_orders(id) on delete set null;
exception when duplicate_object then null;
end $$;
