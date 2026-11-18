-- db/email_dns_changes.sql
-- Log of email DNS changes (MX / SPF / DKIM / DMARC) made from the editor's
-- Email panel on client domains that use Vercel nameservers.
-- Each row keeps the records removed and added so a change can be undone.
-- Idempotent: safe to re-run in the Supabase SQL editor.
--
-- RLS: enabled with no policies — only the service role (api/site/email-dns.js)
-- reads or writes it.

create table if not exists email_dns_changes (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid not null references sites(id) on delete cascade,
  domain         text not null,
  actor_user_id  uuid,
  provider       text not null check (provider in ('google', 'outlook', 'remote', 'undo')),
  options        jsonb not null default '{}'::jsonb,
  removed        jsonb not null default '[]'::jsonb,
  added          jsonb not null default '[]'::jsonb,
  status         text not null default 'pending' check (status in ('pending', 'done', 'failed', 'rolled_back')),
  error          text,
  undone_at      timestamptz,
  undo_of        uuid references email_dns_changes(id) on delete set null,
  created_at     timestamptz not null default now()
);

comment on table email_dns_changes is
  'Email DNS (MX/SPF/DKIM/DMARC) changes applied via Vercel DNS from the editor Email panel. removed/added hold the records so a change can be undone.';

create index if not exists email_dns_changes_site_idx on email_dns_changes (site_id, created_at desc);

alter table email_dns_changes enable row level security;
