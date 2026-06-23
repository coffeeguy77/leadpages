-- Custom domains for leadpages tenants.
-- Run once in the Supabase SQL editor.

alter table public.sites
  add column if not exists custom_domain text;

-- A domain can map to at most one site. The app stores it lower-cased with the
-- protocol/path/www. stripped, so matching against the request Host is exact.
create unique index if not exists sites_custom_domain_key
  on public.sites (custom_domain)
  where custom_domain is not null;
