-- Order Engine — stock pieces (received hams / turkeys, one row per piece).
--
-- Used only for categories switched on in order_systems.settings.stock_control.category_ids.
-- A piece is received with its actual weight, then allocated to an order line
-- (order_items.id). Allocating sets the line's actual weight + final price; releasing
-- puts the piece back to 'available'. All writes go through service-role APIs.
--
-- Safe to re-run. Rollback: drop trigger order_items_release_stock on order_items;
-- drop function order_stock_release_on_item_delete(); drop table order_stock_pieces;

create table if not exists order_stock_pieces (
  id              uuid primary key default gen_random_uuid(),
  order_system_id uuid not null references order_systems(id) on delete cascade,
  site_id         uuid not null references sites(id) on delete cascade,
  product_id      uuid not null references order_products(id) on delete cascade,
  weight_kg       numeric(10,3) not null check (weight_kg > 0),
  tag             text,
  status          text not null default 'available'
    check (status in ('available', 'allocated', 'written_off')),
  order_id        uuid references order_orders(id) on delete set null,
  order_item_id   uuid references order_items(id) on delete set null,
  received_at     timestamptz not null default now(),
  received_by     uuid references profiles(id) on delete set null,
  allocated_at    timestamptz,
  allocated_by    uuid references profiles(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- an allocated piece always points at its order line; others never do
  constraint order_stock_pieces_alloc_chk check (
    (status = 'allocated' and order_item_id is not null)
    or (status <> 'allocated' and order_item_id is null)
  )
);

create index if not exists order_stock_pieces_product_idx
  on order_stock_pieces(product_id, status, weight_kg);
create index if not exists order_stock_pieces_system_idx
  on order_stock_pieces(order_system_id, status);
create index if not exists order_stock_pieces_item_idx
  on order_stock_pieces(order_item_id) where order_item_id is not null;

alter table order_stock_pieces enable row level security;

-- Same as the other order tables: owners / partners / super admins may read; no client writes.
do $$ begin
  create policy order_stock_pieces_select on order_stock_pieces for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

-- Safety net: if an order line is deleted (or its order), its pieces go back into stock.
create or replace function order_stock_release_on_item_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update order_stock_pieces
     set status = 'available', order_id = null, order_item_id = null,
         allocated_at = null, allocated_by = null, updated_at = now()
   where order_item_id = old.id;
  return old;
end;
$$;
drop trigger if exists order_items_release_stock on order_items;
create trigger order_items_release_stock
  before delete on order_items
  for each row execute function order_stock_release_on_item_delete();
