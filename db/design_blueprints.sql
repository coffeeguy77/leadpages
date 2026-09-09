-- db/design_blueprints.sql
-- Layout Composer Phase 2 — additive design blueprint tables.
-- Run in the Supabase SQL editor. Does NOT alter sites.config or positioning_layouts.
-- Blueprints compile into sites.config at create-demo / create-client time.

-- Ordered website structure owned by a user/partner (preset copy or scratch).
create table if not exists public.design_blueprints (
  id uuid primary key default gen_random_uuid(),
  slug text,
  name text not null,
  description text,
  -- preset | user_design | scratch
  kind text not null default 'user_design'
    check (kind in ('preset', 'user_design', 'scratch')),
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'archived')),
  -- When customised from a Themes positioning_layout
  source_preset_id uuid references public.positioning_layouts(id) on delete set null,
  source_preset_slug text,
  theme_ref jsonb not null default '{}'::jsonb,
  -- Logical pages: [{ id, label, path, sections:[{ key, enabled, ... }] }]
  pages jsonb not null default '[]'::jsonb,
  apps jsonb not null default '[]'::jsonb,
  owner_user_id uuid,
  partner_id uuid,
  site_id uuid,
  current_version int not null default 1,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists design_blueprints_owner_idx
  on public.design_blueprints (owner_user_id, updated_at desc);

create index if not exists design_blueprints_partner_idx
  on public.design_blueprints (partner_id, updated_at desc);

create index if not exists design_blueprints_status_idx
  on public.design_blueprints (status, kind);

comment on table public.design_blueprints is
  'Layout Composer blueprints. Compile into sites.config; never replace existing live config in place without explicit create/apply.';

-- Immutable-ish version snapshots for audit / rollback of structure only.
create table if not exists public.design_blueprint_versions (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references public.design_blueprints(id) on delete cascade,
  version int not null,
  pages jsonb not null default '[]'::jsonb,
  apps jsonb not null default '[]'::jsonb,
  theme_ref jsonb not null default '{}'::jsonb,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (blueprint_id, version)
);

create index if not exists design_blueprint_versions_bp_idx
  on public.design_blueprint_versions (blueprint_id, version desc);

comment on table public.design_blueprint_versions is
  'Version history for design_blueprints structure (pages/sections/apps).';

-- Partner / user "My Designs" library entries (points at a blueprint).
create table if not exists public.user_designs (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references public.design_blueprints(id) on delete cascade,
  owner_user_id uuid,
  partner_id uuid,
  title text not null,
  thumbnail_url text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_designs_owner_idx
  on public.user_designs (owner_user_id, updated_at desc);

create index if not exists user_designs_partner_idx
  on public.user_designs (partner_id, updated_at desc);

comment on table public.user_designs is
  'My Designs library for Layout Composer. Source presets stay in positioning_layouts.';

-- Optional link from a site back to the blueprint that compiled it (audit only).
alter table public.sites
  add column if not exists blueprint_id uuid;

alter table public.sites
  add column if not exists blueprint_version int;

comment on column public.sites.blueprint_id is
  'Optional Layout Composer blueprint that compiled into this site.config (audit).';

comment on column public.sites.blueprint_version is
  'Blueprint version number at compile time.';

-- RLS: service role writes from APIs; authenticated owners can read their rows.
alter table public.design_blueprints enable row level security;
alter table public.design_blueprint_versions enable row level security;
alter table public.user_designs enable row level security;

-- Owner read policies. Partner-scoped access is enforced in service-role APIs.
drop policy if exists design_blueprints_select_own on public.design_blueprints;
create policy design_blueprints_select_own on public.design_blueprints
  for select to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists user_designs_select_own on public.user_designs;
create policy user_designs_select_own on public.user_designs
  for select to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists design_blueprint_versions_select_via_bp on public.design_blueprint_versions;
create policy design_blueprint_versions_select_via_bp on public.design_blueprint_versions
  for select to authenticated
  using (
    blueprint_id in (
      select id from public.design_blueprints where owner_user_id = auth.uid()
    )
  );
