-- db/lead_notify_email_styles.sql — run in the Supabase SQL editor.
-- Super-admin styling for website enquiry notification emails (Resend).
-- Service-role only — no anon/authenticated policies.

create table if not exists public.lead_notify_email_styles (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade,
  name text not null default 'Default',
  is_active boolean not null default false,
  is_global_default boolean not null default false,
  style jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_notify_global_site_check check (
    site_id is null or is_global_default = false
  )
);

create index if not exists lead_notify_email_styles_site_idx
  on public.lead_notify_email_styles (site_id, updated_at desc);

create unique index if not exists lead_notify_email_styles_global_default_idx
  on public.lead_notify_email_styles (is_global_default)
  where site_id is null and is_global_default = true;

create unique index if not exists lead_notify_email_styles_site_active_idx
  on public.lead_notify_email_styles (site_id)
  where site_id is not null and is_active = true;

comment on table public.lead_notify_email_styles is
  'Versioned presets for lead notification emails. site_id null = global templates; one is_global_default; per-site one is_active.';

alter table public.lead_notify_email_styles enable row level security;
