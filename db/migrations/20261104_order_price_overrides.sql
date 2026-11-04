-- Order Engine — special prices (per-order price overrides).
--
-- A staff member can give one order line a special price for that order only (bulk buy,
-- a customer relationship). Product prices and every other order are unchanged.
--
--   order_items.price_override   jsonb   the special price on that line (null = normal price)
--     { mode: 'rate' | 'fixed' | 'percent',
--       rate_cents      (mode rate: new $/kg or $ each),
--       line_cents      (mode fixed: price for the whole line),
--       percent         (mode percent: e.g. 10 = 10% off the line),
--       normal_unit_cents  the line's $/kg or $ each before the special price,
--       reason, set_by, set_by_label, set_at }
--   order_orders.has_price_override  boolean  any line on the order has a special price (list pill)
--   order_orders.hide_normal_price   boolean  don't show the customer the normal ("was") price
--
--   order_price_overrides  append-only history: every special price set, changed or removed,
--   with the customer, product, normal and special price. Rows are never updated or deleted
--   by the app, and survive the line / order being removed (FKs set null).
--
-- All writes go through service-role APIs; browser clients may only read (same as other order tables).
-- Safe to re-run. Rollback:
--   drop table order_price_overrides;
--   alter table order_items drop column price_override;
--   alter table order_orders drop column has_price_override, drop column hide_normal_price;

alter table order_items add column if not exists price_override jsonb;
alter table order_orders add column if not exists has_price_override boolean not null default false;
alter table order_orders add column if not exists hide_normal_price boolean not null default false;

create table if not exists order_price_overrides (
  id                  uuid primary key default gen_random_uuid(),
  order_system_id     uuid not null references order_systems(id) on delete cascade,
  site_id             uuid not null references sites(id) on delete cascade,
  order_id            uuid references order_orders(id) on delete set null,
  order_item_id       uuid references order_items(id) on delete set null,
  order_number        text,
  pickup_date         date,
  customer_id         uuid,
  customer_name       text,
  customer_phone      text,
  customer_email      text,
  product_id          uuid,
  product_name        text,
  pricing_method      text,
  quantity            numeric,
  weight_kg           numeric,
  action              text not null default 'set' check (action in ('set', 'changed', 'removed')),
  mode                text check (mode in ('rate', 'fixed', 'percent')),
  normal_unit_cents   integer,
  special_unit_cents  integer,
  percent             numeric,
  normal_line_cents   integer,
  special_line_cents  integer,
  reason              text,
  actor_user_id       uuid,
  actor_label         text,
  created_at          timestamptz not null default now()
);

create index if not exists order_price_overrides_site_idx
  on order_price_overrides(site_id, created_at desc);
create index if not exists order_price_overrides_customer_idx
  on order_price_overrides(site_id, customer_id);
create index if not exists order_price_overrides_product_idx
  on order_price_overrides(site_id, product_id);
create index if not exists order_orders_price_override_idx
  on order_orders(order_system_id) where has_price_override;

alter table order_price_overrides enable row level security;

do $$ begin
  create policy order_price_overrides_select on order_price_overrides for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;
