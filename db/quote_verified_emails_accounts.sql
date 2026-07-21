-- db/quote_verified_emails_accounts.sql
-- Verified email whitelist + email-keyed customer accounts (phone + name aliases).
-- Idempotent: safe to run even if quote_verified_emails does not exist yet.
-- Requires: sites table (from core schema).

create table if not exists quote_verified_emails (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  email         text not null,
  verified_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (site_id, email)
);

comment on table quote_verified_emails is
  'Emails that have completed quote verification for a site — skip re-verification on future quotes. Accounts are keyed by email; phone + name aliases attach to the same row.';

create index if not exists quote_verified_emails_site_email_idx
  on quote_verified_emails(site_id, email);

alter table quote_verified_emails enable row level security;

-- Account fields (phone recorded for SMS; names accumulate as aliases).
alter table quote_verified_emails
  add column if not exists phone text;

alter table quote_verified_emails
  add column if not exists primary_name text;

alter table quote_verified_emails
  add column if not exists name_aliases jsonb not null default '[]'::jsonb;

alter table quote_verified_emails
  add column if not exists updated_at timestamptz not null default now();

comment on column quote_verified_emails.phone is
  'Last verified Australian mobile for this email — SMS still required for each itemised quote.';

comment on column quote_verified_emails.name_aliases is
  'Distinct contact names used with this email (e.g. Rob / Robert).';

create index if not exists quote_verified_emails_site_phone_idx
  on quote_verified_emails(site_id, phone)
  where phone is not null;
