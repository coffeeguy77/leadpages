-- SEO Saver phase 2 + 3: old-URL discovery and the daily monitor.
--
-- seo_saver_candidates: every old address SEO Saver found for a site, from any source
--   (old sitemap, crawl of the old site, Wayback Machine, Google results, backlinks,
--   Search Console, real visits), with what the old page said and the best new page.
--   Rules still live in sites.config.seoSaver — a candidate only becomes a redirect when
--   the editor (or the monitor's auto-add) writes a rule.
-- seo_saver_runs: summaries of discovery runs, launch checks and the daily monitor.
--
-- Written and read only by the service role (api/seo-saver/discover.js, api/cron/seo-saver.js),
-- which check the caller can edit the site. RLS is on with no policies.

create table if not exists public.seo_saver_candidates (
  site_id            uuid        not null references public.sites(id) on delete cascade,
  path               text        not null,                 -- normalised old path (+ ?query when it identifies the page)
  url                text,                                 -- one full old URL as found
  sources            text[]      not null default '{}',    -- sitemap | crawl | wayback | google | backlinks | search_console | visits | manual
  is_page            boolean     not null default true,    -- false for images, PDFs and other files
  archive_ts         text,                                 -- Wayback snapshot timestamp (yyyymmddhhmmss)
  old_status         integer,                              -- HTTP status the old site / archive gave
  old_final          text,                                 -- where the old site itself redirected it (path)
  fetched_at         timestamptz,
  fetch_from         text,                                 -- live | archive
  fetch_error        text,
  title              text,
  h1                 text,
  description        text,
  body               text,                                 -- first few thousand characters of the page text
  backlinks          integer,
  referring_domains  integer,
  clicks             integer,
  impressions        integer,
  visits             integer,
  suggested_to       text,
  confidence         integer,                              -- 0–100
  reason             text,
  alternatives       jsonb,                                -- [{ to, score }]
  status             text        not null default 'open',  -- open | applied | dismissed
  applied_by         text,                                 -- editor | auto
  first_seen         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (site_id, path)
);

create index if not exists seo_saver_candidates_unread on public.seo_saver_candidates (site_id) where fetched_at is null;

create table if not exists public.seo_saver_runs (
  id       bigint generated always as identity primary key,
  site_id  uuid        not null references public.sites(id) on delete cascade,
  kind     text        not null,                           -- monitor | launch_check | discover:<source>
  ran_at   timestamptz not null default now(),
  summary  jsonb       not null default '{}'::jsonb
);

create index if not exists seo_saver_runs_site_kind on public.seo_saver_runs (site_id, kind, ran_at desc);

alter table public.seo_saver_candidates enable row level security;
alter table public.seo_saver_runs enable row level security;

revoke all on table public.seo_saver_candidates from public, anon, authenticated;
revoke all on table public.seo_saver_runs from public, anon, authenticated;
grant all on table public.seo_saver_candidates to service_role;
grant all on table public.seo_saver_runs to service_role;
