-- Order Operations: important flag + ops meta on orders
-- Apply in Supabase SQL editor or via migration runner.

alter table order_orders
  add column if not exists is_important boolean not null default false;

alter table order_orders
  add column if not exists important_meta jsonb not null default '{}'::jsonb;

comment on column order_orders.is_important is
  'Staff-marked important order — highlighted across Pickup Day View, run sheets, and lists.';

comment on column order_orders.important_meta is
  'JSON: { type, colour, reason, show_on_labels, marked_by, marked_at }';

create index if not exists order_orders_important_idx
  on order_orders(order_system_id, pickup_date)
  where is_important = true;
