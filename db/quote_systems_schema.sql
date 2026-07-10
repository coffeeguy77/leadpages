-- db/quote_systems_schema.sql
-- Online Quote System — tenant-isolated quote wizard, verification, and immutable versions.
-- Run once in Supabase SQL editor. Pair with db/quote_systems_rls.sql.
--
-- Namespace: quote_system_* (NOT partner_quotes — that is partner sales quotes).

-- ── Quote system binding (one per site with the marketplace app enabled) ──────

create table if not exists quote_systems (
  id                              uuid primary key default gen_random_uuid(),
  site_id                         uuid not null references sites(id) on delete cascade,
  enabled                         boolean not null default true,
  configuration_classification    text not null default 'blank'
    check (configuration_classification in ('blank', 'public', 'private_superuser')),
  active_config_version_id        uuid,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  unique (site_id)
);

comment on table quote_systems is
  'Per-site online quote app binding. configuration_classification controls who may read/write pricing config.';

create index if not exists quote_systems_site_id_idx on quote_systems(site_id);

-- ── Immutable versioned pricing / wizard configuration ───────────────────────

create table if not exists quote_system_config_versions (
  id                uuid primary key default gen_random_uuid(),
  quote_system_id   uuid not null references quote_systems(id) on delete cascade,
  version_number    integer not null,
  label             text,
  config            jsonb not null default '{}'::jsonb,
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (quote_system_id, version_number)
);

comment on table quote_system_config_versions is
  'Immutable config snapshots. Active pointer lives on quote_systems.active_config_version_id.';

create index if not exists quote_system_config_versions_qs_idx
  on quote_system_config_versions(quote_system_id, version_number desc);

alter table quote_systems
  add constraint quote_systems_active_config_fk
  foreign key (active_config_version_id)
  references quote_system_config_versions(id)
  on delete set null;

-- ── Anonymous / visitor quote wizard sessions ──────────────────────────────────

create table if not exists quote_sessions (
  id                    uuid primary key default gen_random_uuid(),
  site_id               uuid not null references sites(id) on delete cascade,
  quote_system_id       uuid not null references quote_systems(id) on delete cascade,
  session_token         text not null unique,
  status                text not null default 'draft'
    check (status in ('draft', 'submitted', 'accepted', 'expired', 'abandoned')),
  progress              jsonb not null default '{}'::jsonb,
  contact_name          text,
  contact_email         text,
  contact_phone         text,
  email_verified_at     timestamptz,
  sms_verified_at       timestamptz,
  lead_id               uuid references leads(id) on delete set null,
  expires_at            timestamptz not null default (now() + interval '30 days'),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table quote_sessions is
  'In-progress and submitted quote wizard sessions. session_token is the public bearer for visitor APIs.';

create index if not exists quote_sessions_site_idx on quote_sessions(site_id, created_at desc);
create index if not exists quote_sessions_token_idx on quote_sessions(session_token);

-- ── Immutable calculated quote snapshots ─────────────────────────────────────

create table if not exists quote_versions (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references quote_sessions(id) on delete cascade,
  site_id               uuid not null references sites(id) on delete cascade,
  config_version_id     uuid references quote_system_config_versions(id) on delete set null,
  version_number        integer not null,
  inputs                jsonb not null default '{}'::jsonb,
  breakdown             jsonb not null default '[]'::jsonb,
  subtotal_cents        integer not null default 0,
  gst_cents             integer not null default 0,
  total_cents           integer not null default 0,
  verification_level    text not null default 'public_progress'
    check (verification_level in (
      'public_progress',
      'email_verified_total',
      'fully_verified_quote',
      'authorised_admin_quote'
    )),
  created_at            timestamptz not null default now(),
  unique (session_id, version_number)
);

comment on table quote_versions is
  'Immutable server-calculated quote snapshots. Never update — insert new version on recalculation.';

create index if not exists quote_versions_session_idx on quote_versions(session_id, version_number desc);

-- ── Email / SMS verification attempts ────────────────────────────────────────

create table if not exists quote_verifications (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references quote_sessions(id) on delete cascade,
  channel         text not null check (channel in ('email', 'sms')),
  destination     text not null,
  code_hash       text not null,
  sent_at         timestamptz not null default now(),
  verified_at     timestamptz,
  expires_at      timestamptz not null,
  attempt_count   integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists quote_verifications_session_idx
  on quote_verifications(session_id, channel, created_at desc);

-- ── updated_at trigger ───────────────────────────────────────────────────────

create or replace function quote_system_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists quote_systems_touch on quote_systems;
create trigger quote_systems_touch
  before update on quote_systems
  for each row execute function quote_system_touch_updated_at();

drop trigger if exists quote_sessions_touch on quote_sessions;
create trigger quote_sessions_touch
  before update on quote_sessions
  for each row execute function quote_system_touch_updated_at();
