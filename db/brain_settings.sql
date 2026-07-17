-- db/brain_settings.sql — run in the Supabase SQL editor.
-- Durable Brain Control Centre settings (landing draft provider, etc.).
-- Service-role only — no anon/authenticated policies.

create table if not exists public.brain_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.brain_settings is
  'LeadPages Brain durable settings from AI Control Centre. Example key: landing_draft_provider → {"provider":"openai"}.';

alter table public.brain_settings enable row level security;
