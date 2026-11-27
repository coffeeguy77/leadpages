-- Kitchen (cooking) list: per-line kitchen state on order items.
-- kitchen = { done:bool, done_at, done_by, done_by_label, added:bool, label, excluded:bool, check_dismissed:bool }
--   done            — cooked / ticked off in the Kitchen tab
--   added           — staff marked this line as cooked (e.g. a note asked for it)
--   excluded        — staff took this line off the kitchen list
--   check_dismissed — a note mentioned cooking but staff confirmed it is not a cooking request
-- Apply in the Supabase SQL editor (LeadPages project) or via the migration runner.

alter table order_items
  add column if not exists kitchen jsonb not null default '{}'::jsonb;

comment on column order_items.kitchen is
  'Kitchen tab state for cooked lines: done/done_at/done_by, added, excluded, check_dismissed.';
