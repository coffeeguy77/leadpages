-- "How many arrows?" form spam check (Nov 2026) — see lib/form-challenge.js.
-- One row per picture that has been answered, so each picture allows a single try.
-- Only the service role touches this table (RLS on, no policies = no anon/auth access).
-- Rows are tiny; anything older than a day can be deleted at any time.
create table if not exists public.form_challenge_used (
  jti text primary key,
  used_at timestamptz not null default now()
);
create index if not exists form_challenge_used_used_at_idx on public.form_challenge_used (used_at);
alter table public.form_challenge_used enable row level security;
