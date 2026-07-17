-- db/google_ads_schema.sql
-- Base Google Ads + session attribution tables.
-- Run in the Supabase SQL editor (service_role only via RLS with no policies).

-- ── Visitor sessions (first-party attribution) ──────────────────────────────
create table if not exists public.visitor_sessions (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid references public.sites(id) on delete cascade,
  session_id        text not null,
  visitor_id        text not null,
  page_id           text,
  page_type         text,                         -- main | landing_page
  page_url          text,
  landing_page_url  text,
  gclid             text,
  gbraid            text,
  wbraid            text,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  utm_term          text,
  device_type       text,                         -- mobile | desktop | tablet
  traffic_source    text,                         -- google_ads | organic | direct | social | referral | other
  first_visited_at  timestamptz not null default now(),
  last_activity_at  timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (site_id, session_id)
);

create index if not exists visitor_sessions_site_last_idx
  on public.visitor_sessions (site_id, last_activity_at desc);
create index if not exists visitor_sessions_gclid_idx
  on public.visitor_sessions (site_id, gclid)
  where gclid is not null;

alter table public.visitor_sessions enable row level security;

-- ── Google Ads connection (per site) ───────────────────────────────────────
create table if not exists public.google_ads_connections (
  site_id                 uuid primary key references public.sites(id) on delete cascade,
  slug                    text,
  leadpages_user_id       uuid,                   -- LeadPages user who connected
  google_account_email    text,
  granted_scopes          text,
  refresh_token           text not null,          -- AES-256-GCM enc:v1:… (never plaintext)
  access_token            text,                   -- short-lived; also encrypted; refreshed from refresh_token
  token_expires_at        timestamptz,
  customer_id             text,                   -- selected Ads account (digits only)
  account_name            text,
  login_customer_id       text,                   -- MCC / manager customer id when applicable
  conversion_actions      jsonb not null default '{}'::jsonb,
  -- event roles: primary | secondary | off
  event_roles             jsonb not null default '{
    "form_submission":"primary",
    "call_click":"primary",
    "email_click":"secondary",
    "directions_click":"off",
    "quote_click":"secondary",
    "cta_click":"secondary"
  }'::jsonb,
  tag_id                  text,                   -- AW-XXXXXXXX
  connection_status       text not null default 'connected', -- connected | disconnected | error
  disconnected_at         timestamptz,
  enabled                 boolean not null default true,
  last_sync_at            timestamptz,
  last_sync_error         text,
  form_test_at            timestamptz,
  call_test_at            timestamptz,
  connected_at            timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table if not exists public.google_ads_oauth_states (
  nonce               text primary key,
  site_id             uuid,
  leadpages_user_id   uuid,
  expires_at          timestamptz not null,
  used_at             timestamptz,
  created_at          timestamptz not null default now()
);
alter table public.google_ads_oauth_states enable row level security;

comment on table public.google_ads_connections is
  'Per-site Google Ads OAuth credentials and conversion settings. Tokens are sensitive; service_role only.';

alter table public.google_ads_connections enable row level security;

-- ── Synced Ads metrics (daily grain) ───────────────────────────────────────
create table if not exists public.ads_metrics_daily (
  id                bigserial primary key,
  site_id           uuid not null references public.sites(id) on delete cascade,
  customer_id       text not null,
  day               date not null,
  campaign_id       text,
  campaign_name     text,
  ad_group_id       text,
  ad_group_name     text,
  device            text,
  final_url         text,
  page_id           text,                         -- matched LeadPages page
  impressions       bigint not null default 0,
  clicks            bigint not null default 0,
  cost_micros       bigint not null default 0,
  conversions       numeric not null default 0,
  ctr               numeric,
  average_cpc_micros bigint,
  updated_at        timestamptz not null default now(),
  unique (site_id, day, campaign_id, ad_group_id, device, final_url)
);

create index if not exists ads_metrics_daily_site_day_idx
  on public.ads_metrics_daily (site_id, day desc);
create index if not exists ads_metrics_daily_page_idx
  on public.ads_metrics_daily (site_id, page_id)
  where page_id is not null;

alter table public.ads_metrics_daily enable row level security;

-- ── Conversion delivery log ────────────────────────────────────────────────
create table if not exists public.ads_conversion_deliveries (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid references public.sites(id) on delete cascade,
  event_name        text not null,                -- form_submission | call_click | …
  internal_event    text,                         -- lead_submit | call_click
  lead_id           uuid,
  session_id        text,
  visitor_id        text,
  gclid             text,
  gbraid            text,
  wbraid            text,
  conversion_action text,
  status            text not null default 'pending', -- pending | success | failed | skipped
  google_response   jsonb,
  error_message     text,
  occurred_at       timestamptz not null default now(),
  delivered_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists ads_conversion_deliveries_site_idx
  on public.ads_conversion_deliveries (site_id, occurred_at desc);
create index if not exists ads_conversion_deliveries_status_idx
  on public.ads_conversion_deliveries (status, created_at)
  where status in ('pending','failed');

alter table public.ads_conversion_deliveries enable row level security;

-- ── Unmatched Ads destination URLs (health) ────────────────────────────────
create table if not exists public.ads_unmatched_urls (
  id                bigserial primary key,
  site_id           uuid not null references public.sites(id) on delete cascade,
  final_url         text not null,
  last_seen_at      timestamptz not null default now(),
  clicks            bigint not null default 0,
  unique (site_id, final_url)
);

alter table public.ads_unmatched_urls enable row level security;

-- Optional attribution columns on leads (safe if already present)
do $$ begin
  alter table public.leads add column if not exists session_id text;
  alter table public.leads add column if not exists visitor_id text;
  alter table public.leads add column if not exists page_id text;
  alter table public.leads add column if not exists landing_page_url text;
  alter table public.leads add column if not exists gclid text;
  alter table public.leads add column if not exists gbraid text;
  alter table public.leads add column if not exists wbraid text;
  alter table public.leads add column if not exists utm_source text;
  alter table public.leads add column if not exists utm_medium text;
  alter table public.leads add column if not exists utm_campaign text;
  alter table public.leads add column if not exists utm_content text;
  alter table public.leads add column if not exists utm_term text;
  alter table public.leads add column if not exists traffic_source text;
exception when undefined_table then
  raise notice 'leads table missing — skip column adds';
end $$;

create index if not exists leads_traffic_source_idx
  on public.leads (site_id, traffic_source)
  where traffic_source is not null;
