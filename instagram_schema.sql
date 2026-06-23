-- db/instagram_schema.sql
-- Run this in the Supabase SQL editor.
--
-- Assumes you already have a tenant table holding each site's config as jsonb,
-- e.g.  sites ( slug text primary key, config jsonb ).
-- If yours is named differently, set IG_SITES_TABLE / IG_SITE_SLUG_COLUMN /
-- IG_SITE_CONFIG_COLUMN in Vercel env instead of changing this file.

create table if not exists ig_connections (
  slug          text primary key,           -- must match your site's slug/id
  ig_user_id    text not null,              -- Instagram Business Account id (numeric)
  access_token  text not null,              -- long-lived token (SENSITIVE)
  token_expires timestamptz,                -- optional: when the token expires
  enabled       boolean not null default true,
  last_sync     timestamptz,
  last_count    int,
  last_error    text,
  created_at    timestamptz not null default now()
);

comment on table ig_connections is
  'Per-site Instagram Graph API credentials for the Project Feed sync worker. Access tokens are sensitive.';

-- Lock the table down: with RLS enabled and NO policies, only the service_role
-- key (used by the worker, server-side) can read or write it. The anon/public
-- key cannot touch it.
alter table ig_connections enable row level security;
