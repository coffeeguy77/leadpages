-- Ads ↔ GA4 link acknowledgement (LeadPages cannot verify the Google-side link).
-- Run in Supabase SQL editor (idempotent).

alter table public.google_ads_connections
  add column if not exists ads_ga4_link_confirmed_at timestamptz;

alter table public.google_ads_connections
  add column if not exists ads_ga4_link_confirmed_by uuid;

comment on column public.google_ads_connections.ads_ga4_link_confirmed_at is
  'When a user confirmed Ads↔GA4 is linked in Google (Tools → Linked accounts). Clears readiness warn.';
