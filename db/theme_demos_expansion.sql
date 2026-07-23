-- db/theme_demos_expansion.sql — run in Supabase SQL editor after positioning_layouts.sql
-- Extends Themes (positioning_layouts) for the public Demo's library + live Web Demo sites.

alter table public.positioning_layouts
  add column if not exists demo_site_id uuid references public.sites(id) on delete set null;

alter table public.positioning_layouts
  add column if not exists features jsonb not null default '[]'::jsonb;

alter table public.positioning_layouts
  add column if not exists benefits jsonb not null default '[]'::jsonb;

alter table public.positioning_layouts
  add column if not exists promo_headline text;

alter table public.positioning_layouts
  add column if not exists promo_body text;

alter table public.positioning_layouts
  add column if not exists demo_brand_name text;

create index if not exists positioning_layouts_demo_site_idx
  on public.positioning_layouts (demo_site_id)
  where demo_site_id is not null;

create index if not exists positioning_layouts_public_enabled_idx
  on public.positioning_layouts (enabled, visibility, sort_order)
  where enabled = true and visibility = 'public';

comment on column public.positioning_layouts.demo_site_id is
  'Linked live Web Demo site (sites.is_demo) shown on /demos and in the Site Switcher Web Demos bucket.';

comment on column public.positioning_layouts.features is
  'Marketing feature bullets for the public demo promo page.';

comment on column public.positioning_layouts.benefits is
  'Marketing benefit bullets for the public demo promo page.';

comment on column public.positioning_layouts.promo_headline is
  'Optional override headline on /demos/:slug.';

comment on column public.positioning_layouts.promo_body is
  'Optional promo body copy on /demos/:slug.';

comment on column public.positioning_layouts.demo_brand_name is
  'Generic demo business name used after Update scrub (never a real client brand).';
