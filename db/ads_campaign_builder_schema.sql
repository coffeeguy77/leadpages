-- db/ads_campaign_builder_schema.sql
-- Smart Campaign Builder tables (Phases 1–8).
-- Run in the Supabase SQL editor. Idempotent. Service-role only (RLS, no anon policies).
-- Google resource IDs are text (never assume JS-safe integers).

-- ── Cached accessible Ads customers (account picker) ───────────────────────
create table if not exists public.ads_accessible_customers (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.sites(id) on delete cascade,
  customer_id         text not null,              -- digits only
  descriptive_name    text,
  currency_code       text,
  time_zone           text,
  is_manager          boolean not null default false,
  can_mutate          boolean not null default false,
  connection_health   text not null default 'unknown', -- ok | error | unknown
  raw                 jsonb not null default '{}'::jsonb,
  fetched_at          timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  unique (site_id, customer_id)
);
create index if not exists ads_accessible_customers_site_idx
  on public.ads_accessible_customers (site_id);
alter table public.ads_accessible_customers enable row level security;

-- ── Campaign ↔ site ownership map ──────────────────────────────────────────
create table if not exists public.ads_campaign_maps (
  id                      uuid primary key default gen_random_uuid(),
  site_id                 uuid not null references public.sites(id) on delete cascade,
  customer_id             text not null,
  campaign_id             text not null,
  campaign_resource_name  text,
  campaign_name           text,
  campaign_type           text not null default 'SEARCH',
  primary_domain          text,
  status                  text,                   -- ENABLED | PAUSED | REMOVED | …
  ownership               text not null default 'imported',
  -- leadpages_created | imported | leadpages_managed | externally_modified
  build_id                uuid,
  daily_budget_micros     bigint,
  shared_budget_id        text,
  currency_code           text,
  tracking_health         text not null default 'unknown',
  last_synced_at          timestamptz,
  last_external_change_at timestamptz,
  meta                    jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (site_id, customer_id, campaign_id)
);
create index if not exists ads_campaign_maps_site_idx
  on public.ads_campaign_maps (site_id, updated_at desc);
create index if not exists ads_campaign_maps_domain_idx
  on public.ads_campaign_maps (site_id, primary_domain);
alter table public.ads_campaign_maps enable row level security;

-- ── Campaign build records (idempotent creates) ────────────────────────────
create table if not exists public.ads_campaign_builds (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.sites(id) on delete cascade,
  customer_id         text,
  idempotency_key     text not null,
  mode                text not null default 'page', -- page | site | ai
  status              text not null default 'draft',
  -- draft | planned | creating | paused_created | failed | partial
  plan_id             uuid,
  primary_domain      text,
  landing_page_id     text,
  landing_page_url    text,
  created_resources   jsonb not null default '[]'::jsonb,
  partial_errors      jsonb not null default '[]'::jsonb,
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (site_id, idempotency_key)
);
create index if not exists ads_campaign_builds_site_idx
  on public.ads_campaign_builds (site_id, created_at desc);
alter table public.ads_campaign_builds enable row level security;

-- ── Editable generated plans ───────────────────────────────────────────────
create table if not exists public.ads_campaign_plans (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.sites(id) on delete cascade,
  build_id            uuid references public.ads_campaign_builds(id) on delete set null,
  name                text not null,
  mode                text not null default 'page',
  primary_domain      text,
  plan_json           jsonb not null default '{}'::jsonb,
  provenance          jsonb not null default '{}'::jsonb,
  status              text not null default 'draft', -- draft | approved | discarded
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists ads_campaign_plans_site_idx
  on public.ads_campaign_plans (site_id, updated_at desc);
alter table public.ads_campaign_plans enable row level security;

-- ── Resource maps (ad groups, ads, keywords, assets) ───────────────────────
create table if not exists public.ads_resource_maps (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.sites(id) on delete cascade,
  customer_id         text not null,
  campaign_id         text not null,
  resource_type       text not null, -- ad_group | ad | keyword | negative | asset | budget
  resource_id         text not null,
  resource_name       text,
  parent_id           text,
  final_url_domain    text,
  meta                jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (site_id, customer_id, resource_type, resource_id)
);
create index if not exists ads_resource_maps_campaign_idx
  on public.ads_resource_maps (site_id, campaign_id);
alter table public.ads_resource_maps enable row level security;

-- ── Per-campaign conversion goal bindings ──────────────────────────────────
create table if not exists public.ads_conversion_goal_maps (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.sites(id) on delete cascade,
  customer_id         text not null,
  campaign_id         text,
  role                text not null default 'primary', -- primary | secondary | observation
  event_name          text not null,
  google_conversion_action_id text,
  google_conversion_action_name text,
  meta                jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);
create unique index if not exists ads_conversion_goal_maps_uniq
  on public.ads_conversion_goal_maps (site_id, (coalesce(campaign_id, '')), event_name, role);
alter table public.ads_conversion_goal_maps enable row level security;

-- ── Performance snapshots (dashboard cache) ────────────────────────────────
create table if not exists public.ads_perf_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.sites(id) on delete cascade,
  customer_id         text not null,
  scope               text not null default 'campaign', -- account | campaign | ad_group
  scope_id            text not null default '',
  day                 date,
  metrics             jsonb not null default '{}'::jsonb,
  currency_code       text,
  fetched_at          timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  unique (site_id, customer_id, scope, scope_id, day)
);
create index if not exists ads_perf_snapshots_site_idx
  on public.ads_perf_snapshots (site_id, fetched_at desc);
alter table public.ads_perf_snapshots enable row level security;

-- ── Sync locks / cadence ───────────────────────────────────────────────────
create table if not exists public.ads_sync_state (
  site_id             uuid not null references public.sites(id) on delete cascade,
  customer_id         text not null,
  locked_at           timestamptz,
  locked_by           text,
  last_config_sync_at timestamptz,
  last_perf_sync_at   timestamptz,
  last_success_at     timestamptz,
  last_error          text,
  meta                jsonb not null default '{}'::jsonb,
  updated_at          timestamptz not null default now(),
  primary key (site_id, customer_id)
);
alter table public.ads_sync_state enable row level security;

-- ── Budget guardrails (LeadPages monthly monitoring) ───────────────────────
create table if not exists public.ads_budget_guardrails (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.sites(id) on delete cascade,
  customer_id         text not null,
  monthly_allowance   numeric(12,2),
  currency_code       text,
  alert_threshold_pct numeric(5,2) not null default 80,
  enabled             boolean not null default true,
  meta                jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (site_id, customer_id)
);
alter table public.ads_budget_guardrails enable row level security;

-- ── Change proposals + approvals ───────────────────────────────────────────
create table if not exists public.ads_change_proposals (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.sites(id) on delete cascade,
  customer_id         text not null,
  campaign_id         text,
  change_type         text not null, -- create_campaign | pause | resume | budget | gtm_publish | …
  preview             jsonb not null default '{}'::jsonb,
  affects_spend       boolean not null default false,
  status              text not null default 'pending', -- pending | approved | rejected | executed | failed
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists ads_change_proposals_site_idx
  on public.ads_change_proposals (site_id, created_at desc);
alter table public.ads_change_proposals enable row level security;

create table if not exists public.ads_change_approvals (
  id                  uuid primary key default gen_random_uuid(),
  proposal_id         uuid not null references public.ads_change_proposals(id) on delete cascade,
  site_id             uuid not null references public.sites(id) on delete cascade,
  approved_by         uuid,
  confirmation_token  text,
  note                text,
  result              jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);
alter table public.ads_change_approvals enable row level security;

-- ── Audit log ──────────────────────────────────────────────────────────────
create table if not exists public.ads_audit_log (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.sites(id) on delete cascade,
  customer_id         text,
  campaign_id         text,
  actor_user_id       uuid,
  action              text not null,
  before_json         jsonb,
  after_json          jsonb,
  result              jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists ads_audit_log_site_idx
  on public.ads_audit_log (site_id, created_at desc);
alter table public.ads_audit_log enable row level security;

-- ── GTM connections ────────────────────────────────────────────────────────
create table if not exists public.gtm_connections (
  site_id             uuid primary key references public.sites(id) on delete cascade,
  leadpages_user_id   uuid,
  google_account_email text,
  granted_scopes      text,
  refresh_token       text not null,              -- enc:v1:…
  access_token        text,
  token_expires_at    timestamptz,
  account_id          text,
  container_id        text,
  container_public_id text,                       -- GTM-XXXX
  setup_mode          text not null default 'native', -- native | data_layer | managed
  connection_status   text not null default 'connected',
  last_error          text,
  connected_at        timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.gtm_connections enable row level security;

create table if not exists public.gtm_oauth_states (
  nonce               text primary key,
  site_id             uuid,
  leadpages_user_id   uuid,
  expires_at          timestamptz not null,
  used_at             timestamptz,
  created_at          timestamptz not null default now()
);
alter table public.gtm_oauth_states enable row level security;

create table if not exists public.gtm_containers (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.sites(id) on delete cascade,
  account_id          text not null,
  container_id        text not null,
  public_id           text,
  name                text,
  workspace_id        text,
  workspace_name      text,
  published_version_id text,
  version_fingerprint text,
  health              jsonb not null default '{}'::jsonb,
  updated_at          timestamptz not null default now(),
  unique (site_id, account_id, container_id)
);
alter table public.gtm_containers enable row level security;

-- ── Tracking readiness checks ──────────────────────────────────────────────
create table if not exists public.tracking_readiness_checks (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.sites(id) on delete cascade,
  customer_id         text,
  campaign_id         text,
  build_id            uuid,
  overall             text not null default 'fail', -- pass | warn | fail
  checks              jsonb not null default '[]'::jsonb,
  acknowledged_warnings jsonb not null default '[]'::jsonb,
  acknowledged_by     uuid,
  acknowledged_at     timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists tracking_readiness_checks_site_idx
  on public.tracking_readiness_checks (site_id, created_at desc);
alter table public.tracking_readiness_checks enable row level security;

-- ── Recommendations ────────────────────────────────────────────────────────
create table if not exists public.ads_recommendations (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.sites(id) on delete cascade,
  customer_id         text,
  campaign_id         text,
  code                text not null,
  title               text not null,
  plain_language      text,
  evidence            jsonb not null default '{}'::jsonb,
  date_range          text,
  expected_effect     text,
  confidence          text not null default 'medium',
  proposed_change     jsonb not null default '{}'::jsonb,
  affects_spend       boolean not null default false,
  status              text not null default 'open', -- open | dismissed | approved | applied
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists ads_recommendations_site_idx
  on public.ads_recommendations (site_id, status, created_at desc);
alter table public.ads_recommendations enable row level security;
