-- db/google_ads_oauth_hardening.sql
-- Apply after google_ads_schema.sql. Adds OAuth metadata + one-time state nonces.
-- Use one ALTER per column — Postgres rejects comma-chained ADD COLUMN IF NOT EXISTS
-- in some environments (ERROR 42601 near "add").

-- Connection metadata
alter table public.google_ads_connections
  add column if not exists leadpages_user_id uuid;

alter table public.google_ads_connections
  add column if not exists google_account_email text;

alter table public.google_ads_connections
  add column if not exists granted_scopes text;

alter table public.google_ads_connections
  add column if not exists connection_status text not null default 'connected';

alter table public.google_ads_connections
  add column if not exists disconnected_at timestamptz;

comment on column public.google_ads_connections.refresh_token is
  'AES-256-GCM encrypted refresh token (enc:v1:...). Must never be plaintext.';

comment on column public.google_ads_connections.connection_status is
  'connected | disconnected | error';

-- One-time OAuth state nonces (replay protection)
create table if not exists public.google_ads_oauth_states (
  nonce             text primary key,
  site_id           uuid,
  leadpages_user_id uuid,
  expires_at        timestamptz not null,
  used_at           timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists google_ads_oauth_states_exp_idx
  on public.google_ads_oauth_states (expires_at);

alter table public.google_ads_oauth_states enable row level security;
