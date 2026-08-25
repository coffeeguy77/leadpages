-- Order Operations Phase 2: item-level packing checklist
-- Apply in Supabase SQL editor or via migration runner.

alter table order_items
  add column if not exists packed boolean not null default false;

alter table order_items
  add column if not exists packed_at timestamptz;

alter table order_items
  add column if not exists packed_by uuid references profiles(id) on delete set null;

comment on column order_items.packed is
  'Staff packing checklist — line packed for pickup allocation.';

comment on column order_items.packed_at is
  'When the line was marked packed.';

comment on column order_items.packed_by is
  'Staff user who marked the line packed.';

create index if not exists order_items_packed_idx
  on order_items(order_id)
  where packed = true;
