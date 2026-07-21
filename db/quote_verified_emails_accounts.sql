-- db/quote_verified_emails_accounts.sql
-- Extend whitelist into email-keyed customer accounts (phone + name aliases).
-- Run after db/quote_verified_emails.sql.

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
