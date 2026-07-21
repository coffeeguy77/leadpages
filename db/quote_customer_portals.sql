-- db/quote_customer_portals.sql
-- Per-site customer jobs portal (email-scoped access after SMS verify).
-- Run after quote_systems_schema.sql + quote_systems_portal.sql.

create table if not exists quote_customer_portals (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references sites(id) on delete cascade,
  email           text not null,
  access_token    text not null unique,
  phone           text,
  created_at      timestamptz not null default now(),
  last_accessed_at timestamptz,
  unique (site_id, email)
);

comment on table quote_customer_portals is
  'Email-scoped customer portal for listing all quotes/jobs for a site. Issued after SMS verification.';

create index if not exists quote_customer_portals_token_idx
  on quote_customer_portals(access_token);

create index if not exists quote_customer_portals_site_email_idx
  on quote_customer_portals(site_id, email);

alter table quote_customer_portals enable row level security;
-- Service-role APIs only (no browser policies).
