-- db/search_intelligence_schema.sql
-- Leadpages Search Intelligence — DRAFT migration
--
-- DO NOT apply wholesale in production until Phase 1 build.
-- Phase tags in comments: P1 = Foundations MVP, P2+, P3, P4.
-- Pattern mirrors google_ads_schema.sql (site_id FK, encrypted tokens, RLS enabled).
--
-- See docs/search-intelligence/02-DATA-MODEL.md

-- ── OAuth state (P1) ───────────────────────────────────────────────────────
create table if not exists public.si_oauth_states (
  nonce               text primary key,
  site_id             uuid,
  leadpages_user_id   uuid,
  provider            text not null,              -- search_console | ga4 | gbp
  expires_at          timestamptz not null,
  used_at             timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists si_oauth_states_expires_idx
  on public.si_oauth_states (expires_at);

-- ── Connections (P1: search_console, ga4; P3: gbp) ─────────────────────────
create table if not exists public.si_connections (
  id                      uuid primary key default gen_random_uuid(),
  site_id                 uuid not null references public.sites(id) on delete cascade,
  provider                text not null,          -- search_console | ga4 | gbp | …
  google_account_email    text,
  granted_scopes          text,
  refresh_token           text,                   -- enc:v1:… AES-256-GCM
  access_token            text,                   -- enc:v1:… short-lived
  token_expires_at        timestamptz,
  property_id             text,                   -- GSC property URL or GA4 property id
  property_meta           jsonb not null default '{}'::jsonb,
  connection_status       text not null default 'connected', -- connected | disconnected | error
  enabled                 boolean not null default true,
  last_sync_at            timestamptz,
  last_sync_error         text,
  connected_at            timestamptz not null default now(),
  disconnected_at         timestamptz,
  updated_at              timestamptz not null default now(),
  unique (site_id, provider)
);

create index if not exists si_connections_site_idx
  on public.si_connections (site_id);

alter table public.si_connections enable row level security;

-- ── Provider usage / budgets (P1) ──────────────────────────────────────────
create table if not exists public.si_provider_usage (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  partner_id      uuid,
  meter           text not null,                  -- keyword_ideas | serp | rank_check | crawl_pages | ai_prompts | …
  units           integer not null default 1,
  provider        text,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists si_provider_usage_site_created_idx
  on public.si_provider_usage (site_id, created_at desc);

alter table public.si_provider_usage enable row level security;

-- ── Keywords (P1) ──────────────────────────────────────────────────────────
create table if not exists public.si_keywords (
  id              uuid primary key default gen_random_uuid(),
  keyword         text not null,
  language        text not null default 'en',
  country         text not null default 'AU',
  location_key    text,                           -- city/suburb/geo key
  normalised      text not null,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (normalised, language, country, location_key)
);

create index if not exists si_keywords_keyword_idx
  on public.si_keywords (keyword);

-- ── Keyword clusters (P2 primary; table ok in P1) ──────────────────────────
create table if not exists public.si_keyword_clusters (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  name            text not null,
  primary_keyword_id uuid references public.si_keywords(id) on delete set null,
  intent          text,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists si_keyword_clusters_site_idx
  on public.si_keyword_clusters (site_id);

alter table public.si_keyword_clusters enable row level security;

-- ── Tracked keywords (P1) ──────────────────────────────────────────────────
create table if not exists public.si_tracked_keywords (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  keyword_id      uuid not null references public.si_keywords(id) on delete cascade,
  cluster_id      uuid references public.si_keyword_clusters(id) on delete set null,
  device          text not null default 'mobile', -- mobile | desktop
  geo             text,
  cadence         text not null default 'weekly', -- daily | weekly | event
  priority        integer not null default 0,
  active          boolean not null default true,
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (site_id, keyword_id, device, geo)
);

create index if not exists si_tracked_keywords_site_idx
  on public.si_tracked_keywords (site_id) where active = true;

alter table public.si_tracked_keywords enable row level security;

-- ── SERP snapshots (P1) ────────────────────────────────────────────────────
create table if not exists public.si_serp_snapshots (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid references public.sites(id) on delete cascade,
  keyword_id      uuid not null references public.si_keywords(id) on delete cascade,
  provider        text not null,
  device          text not null default 'mobile',
  geo             text,
  fetched_at      timestamptz not null default now(),
  label_class     text not null default 'estimated', -- measured | estimated | modelled
  features        jsonb not null default '[]'::jsonb,
  raw_ref         text,                           -- optional external id
  meta            jsonb not null default '{}'::jsonb
);

create index if not exists si_serp_snapshots_kw_fetched_idx
  on public.si_serp_snapshots (keyword_id, fetched_at desc);

create table if not exists public.si_serp_results (
  id              uuid primary key default gen_random_uuid(),
  snapshot_id     uuid not null references public.si_serp_snapshots(id) on delete cascade,
  rank            integer,
  result_type     text not null default 'organic', -- organic | maps | paa | ai_overview | …
  url             text,
  domain          text,
  title           text,
  snippet         text,
  meta            jsonb not null default '{}'::jsonb
);

create index if not exists si_serp_results_snapshot_idx
  on public.si_serp_results (snapshot_id);

-- ── Rank observations (P1) ─────────────────────────────────────────────────
create table if not exists public.si_rank_observations (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  tracked_keyword_id uuid references public.si_tracked_keywords(id) on delete set null,
  keyword_id      uuid not null references public.si_keywords(id) on delete cascade,
  url             text,
  position        numeric,
  device          text not null default 'mobile',
  geo             text,
  provider        text not null,
  label_class     text not null default 'estimated',
  features        jsonb not null default '[]'::jsonb,
  fetched_at      timestamptz not null default now()
);

create index if not exists si_rank_observations_site_fetched_idx
  on public.si_rank_observations (site_id, fetched_at desc);

alter table public.si_rank_observations enable row level security;

-- ── Pages (P1) ─────────────────────────────────────────────────────────────
create table if not exists public.si_pages (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  url             text not null,
  page_kind       text not null default 'other',  -- home | landing | suburb | other
  landing_slug    text,
  suburb_slug     text,
  config_path     text,                           -- optional pointer into sites.config
  title           text,
  meta_description text,
  indexable       boolean,
  meta            jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (site_id, url)
);

create index if not exists si_pages_site_kind_idx
  on public.si_pages (site_id, page_kind);

alter table public.si_pages enable row level security;

-- ── GSC query × page stats (P1) ────────────────────────────────────────────
create table if not exists public.si_query_page_stats (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  page_id         uuid references public.si_pages(id) on delete set null,
  query           text not null,
  page_url        text not null,
  period_start    date not null,
  period_end      date not null,
  clicks          integer not null default 0,
  impressions     integer not null default 0,
  ctr             numeric,
  position        numeric,
  device          text,
  country         text,
  label_class     text not null default 'measured',
  fetched_at      timestamptz not null default now()
);

create unique index if not exists si_query_page_stats_uniq
  on public.si_query_page_stats (
    site_id, query, page_url, period_start, period_end,
    coalesce(device, ''), coalesce(country, '')
  );

create index if not exists si_query_page_stats_site_period_idx
  on public.si_query_page_stats (site_id, period_end desc);

alter table public.si_query_page_stats enable row level security;

-- ── Crawl & issues (P1) ────────────────────────────────────────────────────
create table if not exists public.si_crawl_runs (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  status          text not null default 'queued', -- queued | running | done | failed
  started_at      timestamptz,
  finished_at     timestamptz,
  pages_crawled   integer not null default 0,
  source          text not null default 'leadpages', -- leadpages | external (P3+)
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists si_crawl_runs_site_idx
  on public.si_crawl_runs (site_id, created_at desc);

alter table public.si_crawl_runs enable row level security;

create table if not exists public.si_issues (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  crawl_run_id    uuid references public.si_crawl_runs(id) on delete set null,
  page_id         uuid references public.si_pages(id) on delete set null,
  code            text not null,                  -- recipe or issue code
  severity        text not null default 'medium', -- critical | high | medium | low
  title           text not null,
  evidence        jsonb not null default '{}'::jsonb,
  why_it_matters  text,
  recommended_fix text,
  auto_fix_allowed boolean not null default false,
  fix_owner       text not null default 'client', -- client | partner | platform | external
  confidence      numeric,
  detected_at     timestamptz not null default now(),
  resolved_at     timestamptz,
  meta            jsonb not null default '{}'::jsonb
);

create index if not exists si_issues_site_open_idx
  on public.si_issues (site_id, severity) where resolved_at is null;

alter table public.si_issues enable row level security;

-- ── Competitors (P1 light; P4 deep) ────────────────────────────────────────
create table if not exists public.si_competitors (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  domain          text not null,
  competitor_type text not null default 'search', -- business | search
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (site_id, domain)
);

alter table public.si_competitors enable row level security;

create table if not exists public.si_competitor_keywords (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  competitor_id   uuid not null references public.si_competitors(id) on delete cascade,
  keyword_id      uuid not null references public.si_keywords(id) on delete cascade,
  position        numeric,
  meta            jsonb not null default '{}'::jsonb,
  fetched_at      timestamptz not null default now(),
  unique (competitor_id, keyword_id)
);

alter table public.si_competitor_keywords enable row level security;

-- ── Recommendations & approvals (P1) ───────────────────────────────────────
create table if not exists public.si_recommendations (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  recipe_id       text not null,
  status          text not null default 'open',   -- open | snoozed | dismissed | in_progress | done
  severity        text not null default 'medium',
  title           text not null,
  plain_language  text,
  evidence        jsonb not null default '{}'::jsonb,
  impact_estimate jsonb not null default '{}'::jsonb,
  confidence      numeric,
  page_id         uuid references public.si_pages(id) on delete set null,
  keyword_id      uuid references public.si_keywords(id) on delete set null,
  snooze_until    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

create index if not exists si_recommendations_site_status_idx
  on public.si_recommendations (site_id, status);

alter table public.si_recommendations enable row level security;

create table if not exists public.si_recommendation_actions (
  id              uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.si_recommendations(id) on delete cascade,
  action_id       text not null,                  -- open_editor_seo | create_landing_draft | …
  status          text not null default 'requested', -- requested | completed | failed
  actor_user_id   uuid,
  result          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists public.si_approvals (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  recommendation_id uuid references public.si_recommendations(id) on delete set null,
  subject_type    text not null,                  -- recommendation | draft | auto_fix
  subject_id      text,
  decision        text not null,                  -- approved | rejected | revoked
  actor_user_id   uuid,
  actor_role      text,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists si_approvals_site_idx
  on public.si_approvals (site_id, created_at desc);

alter table public.si_approvals enable row level security;

-- ── Annotations (P2) ───────────────────────────────────────────────────────
create table if not exists public.si_annotations (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  annotation_type text not null,                  -- publish | meta_test | crawl | manual
  title           text,
  detail          jsonb not null default '{}'::jsonb,
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists si_annotations_site_idx
  on public.si_annotations (site_id, occurred_at desc);

alter table public.si_annotations enable row level security;

-- ── Report snapshots (P1) ──────────────────────────────────────────────────
create table if not exists public.si_report_snapshots (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites(id) on delete cascade,
  period_start    date not null,
  period_end      date not null,
  report_kind     text not null default 'monthly', -- monthly | weekly | adhoc
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists si_report_snapshots_site_idx
  on public.si_report_snapshots (site_id, period_end desc);

alter table public.si_report_snapshots enable row level security;
