-- Partner showcase library (Nov 2026)
--
-- LeadPages sites the platform owner allows partners to display on their partner pages
-- ("Built on LeadPages" gallery). Ticked per site by a super admin in /manage.
--
-- One row = one site in the library. Removing the tick deletes the row; deleting the site
-- removes it automatically. Partners choose what they show (all / random / selected) in
-- their own page settings (partner_profiles.showcase_config.websiteProfile.showcaseLibrary).
--
-- RLS is on with no policies: only the server (service role) reads or writes this table,
-- through /api/partner/showcase-library, which checks super admin for every change.
-- Safe to run more than once.

create table if not exists public.partner_showcase_library (
  site_id uuid primary key references public.sites(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid,
  sort_order integer not null default 0
);

create index if not exists partner_showcase_library_added_at_idx
  on public.partner_showcase_library (added_at desc);

alter table public.partner_showcase_library enable row level security;

comment on table public.partner_showcase_library is
  'LeadPages sites partners may show on their partner pages. Super-admin managed via /api/partner/showcase-library; service role only.';
