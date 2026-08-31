-- db/domain_finder.sql
-- AI Domain Finder — search sessions, candidates, availability cache.
-- Run in the Supabase SQL editor. Idempotent.
-- Service-role API is the write path; RLS enabled with no anon policies.

create table if not exists public.domain_finder_sessions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references public.profiles(id) on delete set null,
  site_id               uuid references public.sites(id) on delete set null,
  business_description  text not null default '',
  business_type         text not null default 'Local Business',
  location              text not null default '',
  preferred_words       jsonb not null default '[]'::jsonb,
  excluded_words        jsonb not null default '[]'::jsonb,
  existing_ideas        jsonb not null default '[]'::jsonb,
  preferred_tlds        jsonb not null default '["com.au","au","net.au"]'::jsonb,
  mode                  text not null default 'standard',
  status                text not null default 'completed'
    check (status in ('running','completed','failed','partial')),
  progress              jsonb not null default '[]'::jsonb,
  meta                  jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists domain_finder_sessions_user_created_idx
  on public.domain_finder_sessions (user_id, created_at desc);
create index if not exists domain_finder_sessions_site_created_idx
  on public.domain_finder_sessions (site_id, created_at desc);

comment on table public.domain_finder_sessions is
  'AI Domain Finder search sessions (brief + progress + meta).';

create table if not exists public.domain_finder_candidates (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references public.domain_finder_sessions(id) on delete cascade,
  display_name          text not null default '',
  root                  text not null,
  full_domain           text not null,
  tld                   text not null,
  strategy              text not null default 'brandable',
  availability          text not null default 'available'
    check (availability in ('pending','checking','available','unavailable','error','unknown')),
  price                 numeric,
  currency              text not null default 'AUD',
  premium               boolean not null default false,
  ai_score              numeric,
  ai_reason             text not null default '',
  scores                jsonb not null default '{}'::jsonb,
  badge                 text,
  generation_round      integer not null default 1,
  saved                 boolean not null default false,
  selected              boolean not null default false,
  created_at            timestamptz not null default now()
);

create index if not exists domain_finder_candidates_session_idx
  on public.domain_finder_candidates (session_id, ai_score desc nulls last);
create index if not exists domain_finder_candidates_saved_idx
  on public.domain_finder_candidates (session_id, saved) where saved = true;
create unique index if not exists domain_finder_candidates_session_domain_uidx
  on public.domain_finder_candidates (session_id, full_domain);

comment on table public.domain_finder_candidates is
  'Available (and saved) domain candidates from Domain Finder sessions.';

create table if not exists public.domain_finder_availability_cache (
  full_domain           text primary key,
  tld                   text not null,
  status                text not null default 'unknown'
    check (status in ('available','unavailable','unknown')),
  price                 numeric,
  currency              text not null default 'AUD',
  premium               boolean not null default false,
  checked_at            timestamptz not null default now()
);

create index if not exists domain_finder_availability_cache_checked_idx
  on public.domain_finder_availability_cache (checked_at desc);

comment on table public.domain_finder_availability_cache is
  'Short-lived domain availability cache for Domain Finder (not a purchase guarantee).';

alter table public.domain_finder_sessions enable row level security;
alter table public.domain_finder_candidates enable row level security;
alter table public.domain_finder_availability_cache enable row level security;
-- No anon/authenticated policies — service role only via API.
