-- db/theme_studio.sql — run in the Supabase SQL editor.
-- Theme Studio V2 draft workspace + immutable concept versions.
-- Service-role only — no anon/authenticated policies.
-- Generation never writes live sites; apply is a separate controlled API.

create table if not exists public.theme_studio_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  partner_id uuid,
  mode text not null default 'new'
    check (mode in ('new', 'redesign', 'demo', 'template', 'restyle')),
  source_site_id text,
  target_site_id text,
  status text not null default 'open'
    check (status in ('open', 'applied', 'cancelled')),
  brief jsonb not null default '{}'::jsonb,
  foundation_id text,
  selected_concept_id text,
  selected_version_id uuid,
  applied_config jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists theme_studio_drafts_owner_idx
  on public.theme_studio_drafts (owner_user_id, created_at desc);

create index if not exists theme_studio_drafts_status_idx
  on public.theme_studio_drafts (status);

comment on table public.theme_studio_drafts is
  'Theme Studio V2 workspaces. Draft-only generation; live apply is explicit and separate.';

create table if not exists public.theme_studio_versions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.theme_studio_drafts(id) on delete cascade,
  concept_id text not null,
  version_number int not null,
  kind text not null default 'generate'
    check (kind in (
      'generate',
      'refine',
      'select',
      'apply',
      'template',
      'direct_edit',
      'manual_edit',
      'restore',
      'approve',
      'images'
    )),
  concept_json jsonb not null,
  draft_config_json jsonb,
  adapter_warnings jsonb not null default '[]'::jsonb,
  quality_report jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (draft_id, version_number)
);

create index if not exists theme_studio_versions_draft_idx
  on public.theme_studio_versions (draft_id, version_number desc);

comment on table public.theme_studio_versions is
  'Immutable Theme Studio concept/config snapshots per generate or refine.';

-- Optional private templates (Phase 10)
create table if not exists public.theme_studio_templates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  partner_id uuid,
  name text not null,
  foundation_id text,
  concept_json jsonb not null,
  draft_config_json jsonb,
  visibility text not null default 'private'
    check (visibility in ('private', 'partner', 'submitted')),
  status text not null default 'active'
    check (status in ('active', 'archived', 'in_review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists theme_studio_templates_owner_idx
  on public.theme_studio_templates (owner_user_id, created_at desc);

alter table public.theme_studio_drafts enable row level security;
alter table public.theme_studio_versions enable row level security;
alter table public.theme_studio_templates enable row level security;
