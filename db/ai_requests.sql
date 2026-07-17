-- db/ai_requests.sql — run in the Supabase SQL editor.
-- Durable Brain usage / cost ledger for AI Control Centre.
-- Estimates are token×price (ops forecast), not a 1:1 provider invoice.

create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  correlation_id text,
  created_at timestamptz not null default now(),
  actor_user_id uuid,
  partner_id uuid,
  site_id text,
  task_id text not null,
  prompt_id text,
  prompt_version int,
  provider text,
  model text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cached_tokens int not null default 0,
  cost_usd numeric(14, 6) not null default 0,
  latency_ms int,
  success boolean not null default true,
  error_code text,
  fallback_used boolean not null default false,
  meta jsonb not null default '{}'::jsonb
);

-- UNIQUE allows multiple NULLs in Postgres; non-null correlation_id is idempotent.
create unique index if not exists ai_requests_correlation_uidx
  on public.ai_requests (correlation_id);

create index if not exists ai_requests_created_at_idx
  on public.ai_requests (created_at desc);

create index if not exists ai_requests_provider_created_idx
  on public.ai_requests (provider, created_at desc);

create index if not exists ai_requests_task_created_idx
  on public.ai_requests (task_id, created_at desc);

alter table public.ai_requests enable row level security;

-- Service-role only (Brain gateway + Control Centre API). No anon/authenticated policies.
comment on table public.ai_requests is
  'LeadPages Brain per-call usage ledger. cost_usd is estimated from published model rates × tokens.';
