-- db/positioning_layouts.sql — run in the Supabase SQL editor.
-- Platform positioning layouts: which apps are on + their homepage order,
-- with optional demo content packs and preview images for the Themes picker.
-- Service-role writes from /api/api-positioning-layouts; partners/clients read enabled layouts.

create table if not exists public.positioning_layouts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  theme_image_url text,
  layout_image_url text,
  section_order jsonb not null default '[]'::jsonb,
  apps jsonb not null default '[]'::jsonb,
  -- Map of section_key -> demo config snapshot (hero slides, trust badges, etc.)
  demo_packs jsonb not null default '{}'::jsonb,
  industry_tags text[] not null default '{}',
  visibility text not null default 'partners'
    check (visibility in ('admin', 'partners', 'public')),
  sort_order int not null default 0,
  enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists positioning_layouts_enabled_sort_idx
  on public.positioning_layouts (enabled, sort_order, created_at desc);

create index if not exists positioning_layouts_visibility_idx
  on public.positioning_layouts (visibility);

comment on table public.positioning_layouts is
  'Admin-authored positioning layouts: app stack + order + optional demo packs for Themes picker.';

comment on column public.positioning_layouts.apps is
  'Array of { section_key, enabled, label? } describing which homepage apps the layout uses.';

comment on column public.positioning_layouts.demo_packs is
  'Optional section_key -> config object. Applied only with fill_empty or demo_replace modes.';

comment on column public.positioning_layouts.theme_image_url is
  'Marketing screenshot of the finished look (hero, colours, imagery).';

comment on column public.positioning_layouts.layout_image_url is
  'Diagram of section positioning (wireframe / stack order).';

-- Reusable per-app demo content packs (e.g. surfing-school hero slider).
create table if not exists public.app_config_packs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  section_key text not null,
  name text not null,
  description text,
  industry_tag text,
  preview_image_url text,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_config_packs_section_idx
  on public.app_config_packs (section_key, enabled);

comment on table public.app_config_packs is
  'Named demo configs for a single app/section (Cloudinary banners, copy, etc.).';

alter table public.positioning_layouts enable row level security;
alter table public.app_config_packs enable row level security;

-- Authenticated users can browse enabled partner/public layouts (UI still goes through API).
drop policy if exists positioning_layouts_select_enabled on public.positioning_layouts;
create policy positioning_layouts_select_enabled on public.positioning_layouts
  for select to authenticated
  using (enabled = true and visibility in ('partners', 'public'));

drop policy if exists app_config_packs_select_enabled on public.app_config_packs;
create policy app_config_packs_select_enabled on public.app_config_packs
  for select to authenticated
  using (enabled = true);
