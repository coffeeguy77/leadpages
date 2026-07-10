-- db/quote_systems_portal.sql
-- Stage 8: customer portal links, acceptance audit, view tracking.
-- Run after db/quote_systems_schema.sql

alter table quote_sessions add column if not exists portal_token text unique;
alter table quote_sessions add column if not exists accepted_at timestamptz;
alter table quote_sessions add column if not exists portal_viewed_at timestamptz;
alter table quote_sessions add column if not exists portal_last_viewed_at timestamptz;
alter table quote_sessions add column if not exists portal_view_count integer not null default 0;

create index if not exists quote_sessions_portal_token_idx on quote_sessions(portal_token);

comment on column quote_sessions.portal_token is
  'Opaque token for /quote-portal?t=... — issued after SMS verification.';

create table if not exists quote_acceptances (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references quote_sessions(id) on delete cascade,
  quote_version_id  uuid references quote_versions(id) on delete set null,
  accepted_by_name  text,
  accepted_by_email text,
  accepted_at       timestamptz not null default now(),
  ip_hash           text,
  user_agent        text
);

create index if not exists quote_acceptances_session_idx on quote_acceptances(session_id, accepted_at desc);

comment on table quote_acceptances is
  'Immutable record when a customer accepts a verified online quote via the portal.';

alter table quote_acceptances enable row level security;
