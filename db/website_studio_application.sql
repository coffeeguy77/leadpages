-- db/website_studio_application.sql — run in the Supabase SQL editor.
-- Website Studio Phase 6 — durable application audit + idempotency.
-- Service-role only — no anon/authenticated policies.
-- Retention: retain successful audits ≥ 365 days; failures ≥ 90 days (ops policy).
-- Never store API keys, Cloudinary secrets, auth tokens, or full private briefs.

create table if not exists public.website_studio_application_audits (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id text not null,
  actor_user_id uuid,
  role text,
  created_at timestamptz not null default now(),
  source_concept_id text,
  source_version_id uuid,
  source_draft_id uuid,
  destination_account_id text,
  destination_site_id text,
  application_mode text,
  validation_result text,
  warnings_acknowledged boolean not null default false,
  override_reason text,
  apps_installed jsonb not null default '[]'::jsonb,
  images_imported jsonb not null default '[]'::jsonb,
  result_type text,
  success boolean not null default false,
  failure_stage text,
  resulting_draft_version_id uuid,
  resulting_site_id text,
  resulting_template_id uuid,
  idempotency_key text,
  notice text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists website_studio_application_audits_created_idx
  on public.website_studio_application_audits (created_at desc);

create index if not exists website_studio_application_audits_actor_idx
  on public.website_studio_application_audits (actor_user_id, created_at desc);

create index if not exists website_studio_application_audits_site_idx
  on public.website_studio_application_audits (destination_site_id, created_at desc);

create index if not exists website_studio_application_audits_diag_idx
  on public.website_studio_application_audits (diagnostic_id);

comment on table public.website_studio_application_audits is
  'Website Studio application attempts. No secrets. Tenant-scoped via actor/site ids.';

-- Idempotency keys survive serverless restarts / redeploys.
create table if not exists public.website_studio_application_idempotency (
  idempotency_key text primary key,
  actor_user_id uuid,
  result jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists website_studio_application_idempotency_actor_idx
  on public.website_studio_application_idempotency (actor_user_id, created_at desc);

comment on table public.website_studio_application_idempotency is
  'Website Studio application idempotency. Prevents duplicate site creation across retries.';

alter table public.website_studio_application_audits enable row level security;
alter table public.website_studio_application_idempotency enable row level security;
