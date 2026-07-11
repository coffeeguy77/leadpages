-- db/quote_verified_emails.sql
-- Per-site verified email whitelist for the Online Quote System.
-- Run after quote_systems_schema.sql. Pair with quote_systems_rls.sql update.

create table if not exists quote_verified_emails (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  email         text not null,
  verified_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (site_id, email)
);

comment on table quote_verified_emails is
  'Emails that have completed quote verification for a site — skip re-verification on future quotes.';

create index if not exists quote_verified_emails_site_email_idx
  on quote_verified_emails(site_id, email);

alter table quote_verified_emails enable row level security;

-- No browser policies — service role APIs only (same as quote_verifications).
