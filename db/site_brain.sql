-- db/site_brain.sql — run in the Supabase SQL editor.
-- Site Brain: tenant-scoped knowledge for the AI Website Team.
-- Separate from sites.config (renderer source of truth).
-- Service-role only — no anon/authenticated policies.

create table if not exists public.site_brains (
  id uuid primary key default gen_random_uuid(),
  site_id text not null unique,
  account_id text,
  version int not null default 1,
  snapshot jsonb not null default '{}'::jsonb,
  bootstrap_status text not null default 'pending'
    check (bootstrap_status in ('pending', 'awaiting_review', 'reviewed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

create index if not exists site_brains_site_idx on public.site_brains (site_id);
create index if not exists site_brains_account_idx on public.site_brains (account_id);

comment on table public.site_brains is
  'Current Site Brain snapshot per website. Not renderer config.';

create table if not exists public.site_brain_events (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  brain_id uuid references public.site_brains(id) on delete cascade,
  version_before int,
  version_after int,
  event_type text not null,
  path text,
  before_value jsonb,
  after_value jsonb,
  source text,
  actor_user_id uuid,
  actor_role text,
  request_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists site_brain_events_site_idx
  on public.site_brain_events (site_id, created_at desc);

comment on table public.site_brain_events is
  'Append-only Site Brain mutation history.';

create table if not exists public.site_brain_recommendations (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  brain_id uuid references public.site_brains(id) on delete cascade,
  specialist text not null,
  title text not null,
  problem text,
  evidence jsonb not null default '[]'::jsonb,
  proposed_change jsonb not null default '{}'::jsonb,
  reason text,
  estimated_effort text,
  affected_areas jsonb not null default '[]'::jsonb,
  required_permissions jsonb not null default '[]'::jsonb,
  risk text,
  status text not null default 'proposed'
    check (status in (
      'proposed',
      'awaiting-review',
      'approved',
      'rejected',
      'in-progress',
      'completed',
      'failed',
      'superseded'
    )),
  executable boolean not null default false,
  capability_gap boolean not null default false,
  editor_context jsonb not null default '{}'::jsonb,
  guardian jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_brain_recs_site_idx
  on public.site_brain_recommendations (site_id, created_at desc);
create index if not exists site_brain_recs_status_idx
  on public.site_brain_recommendations (site_id, status);

comment on table public.site_brain_recommendations is
  'AI Website Team recommendations (advisory lifecycle).';

alter table public.site_brains enable row level security;
alter table public.site_brain_events enable row level security;
alter table public.site_brain_recommendations enable row level security;
-- No anon/authenticated policies — service role only.
