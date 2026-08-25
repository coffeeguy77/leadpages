-- db/order_engine_rls.sql
-- LeadPages Order Engine — RLS. Browser may SELECT for owners/partners/supers;
-- all writes go through service-role APIs (bypass RLS).

alter table order_systems enable row level security;
alter table order_categories enable row level security;
alter table order_products enable row level security;
alter table order_product_questions enable row level security;
alter table order_product_relationships enable row level security;
alter table order_customers enable row level security;
alter table order_carts enable row level security;
alter table order_cart_items enable row level security;
alter table order_orders enable row level security;
alter table order_items enable row level security;
alter table order_item_answers enable row level security;
alter table order_payments enable row level security;
alter table order_changes enable row level security;
alter table order_change_requests enable row level security;
alter table order_access_tokens enable row level security;
alter table order_message_templates enable row level security;
alter table order_messages enable row level security;
alter table order_abandoned_events enable row level security;
alter table order_fulfilment_windows enable row level security;
alter table order_date_locks enable row level security;
alter table order_audit_events enable row level security;
alter table order_print_snapshots enable row level security;

-- Shared site-access expression (owner / super / active partner)
-- Applied as SELECT policies; no INSERT/UPDATE/DELETE for anon/authenticated clients.

create or replace function order_engine_site_visible(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from sites s
    where s.id = p_site_id
      and (
        s.owner_user_id = auth.uid()
        or exists (
          select 1 from profiles p
          where p.id = auth.uid() and p.is_super_admin = true
        )
        or exists (
          select 1 from partners pr
          where pr.user_id = auth.uid()
            and pr.status = 'active'
            and (s.servicing_partner_id = pr.id or s.referring_partner_id = pr.id)
        )
      )
  );
$$;

revoke all on function order_engine_site_visible(uuid) from public;
grant execute on function order_engine_site_visible(uuid) to authenticated;

do $$ begin
  create policy order_systems_select on order_systems for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_categories_select on order_categories for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_products_select on order_products for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_product_questions_select on order_product_questions for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_product_relationships_select on order_product_relationships for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_customers_select on order_customers for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_carts_select on order_carts for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_cart_items_select on order_cart_items for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_orders_select on order_orders for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_items_select on order_items for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_item_answers_select on order_item_answers for select
    using (
      exists (
        select 1 from order_items oi
        where oi.id = order_item_answers.order_item_id
          and order_engine_site_visible(oi.site_id)
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_payments_select on order_payments for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_changes_select on order_changes for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_change_requests_select on order_change_requests for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_message_templates_select on order_message_templates for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_messages_select on order_messages for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_abandoned_events_select on order_abandoned_events for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_fulfilment_windows_select on order_fulfilment_windows for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_date_locks_select on order_date_locks for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_audit_events_select on order_audit_events for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy order_print_snapshots_select on order_print_snapshots for select
    using (order_engine_site_visible(site_id));
exception when duplicate_object then null; end $$;

-- Access tokens: no client SELECT (service role only)
-- (RLS enabled with zero policies → denied for anon/authenticated)
