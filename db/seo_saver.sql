-- SEO Saver: old-URL hits on a tenant site (404s, redirects served, fallbacks).
--
-- The redirect rules themselves live in sites.config.seoSaver (so they ship with
-- the site, are covered by site backups, and need no extra query per request).
-- This table only records what visitors and Google actually requested, so the
-- editor can show "URLs we couldn't find" and how often each redirect is used.
--
-- Written only by the service role from api/render.js (via seo_saver_log) and read
-- only through /api/seo-saver/hits, which checks the caller can edit the site.
-- RLS is on with no policies: anon/authenticated clients cannot read or write it.
--
-- Hit counts are approximate: responses are CDN-cached for a few minutes, so a
-- popular URL is counted once per cache window per edge region.

create table if not exists public.site_url_hits (
  site_id        uuid        not null references public.sites(id) on delete cascade,
  path           text        not null,                 -- normalised request path (+ query when it mattered)
  kind           text        not null default 'not_found', -- not_found | redirect | fallback | gone
  target         text,                                 -- where we sent it (redirect / fallback)
  hits           bigint      not null default 0,
  google_hits    bigint      not null default 0,       -- requests from Googlebot
  first_seen     timestamptz not null default now(),
  last_seen      timestamptz not null default now(),
  last_referrer  text,
  dismissed      boolean     not null default false,   -- hidden from the 404 list by the editor
  primary key (site_id, path)
);

create index if not exists site_url_hits_site_last_seen on public.site_url_hits (site_id, last_seen desc);

alter table public.site_url_hits enable row level security;

-- Record one request. New rows stop being added once a site has 2,000 logged paths
-- (stops bots that probe random URLs from filling the table); existing rows still count.
create or replace function public.seo_saver_log(
  p_site uuid, p_path text, p_kind text, p_target text, p_referrer text, p_google boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text := left(coalesce(p_path, ''), 500);
  v_kind text := case when p_kind in ('not_found', 'redirect', 'fallback', 'gone') then p_kind else 'not_found' end;
begin
  if p_site is null or v_path = '' then return; end if;
  update public.site_url_hits
     set hits = hits + 1,
         google_hits = google_hits + case when p_google then 1 else 0 end,
         kind = v_kind,
         target = left(p_target, 500),
         last_seen = now(),
         last_referrer = coalesce(left(nullif(p_referrer, ''), 500), last_referrer)
   where site_id = p_site and path = v_path;
  if found then return; end if;
  if (select count(*) from public.site_url_hits where site_id = p_site) >= 2000 then return; end if;
  insert into public.site_url_hits (site_id, path, kind, target, hits, google_hits, last_referrer)
  values (p_site, v_path, v_kind, left(p_target, 500), 1, case when p_google then 1 else 0 end, left(nullif(p_referrer, ''), 500))
  on conflict (site_id, path) do update
     set hits = public.site_url_hits.hits + 1,
         google_hits = public.site_url_hits.google_hits + excluded.google_hits,
         kind = excluded.kind, target = excluded.target, last_seen = now(),
         last_referrer = coalesce(excluded.last_referrer, public.site_url_hits.last_referrer);
end;
$$;

revoke all on table public.site_url_hits from public, anon, authenticated;
revoke all on function public.seo_saver_log(uuid, text, text, text, text, boolean) from public, anon, authenticated;
grant all on table public.site_url_hits to service_role;
grant execute on function public.seo_saver_log(uuid, text, text, text, text, boolean) to service_role;
