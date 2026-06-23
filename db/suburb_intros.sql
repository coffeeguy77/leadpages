-- db/suburb_intros.sql  — run in the Supabase SQL editor.
-- Caches one unique AI-written intro per (site, suburb) so each page is generated once.

create table if not exists suburb_intros (
  site       text not null,
  suburb     text not null,
  intro      text not null,
  updated_at timestamptz not null default now(),
  primary key (site, suburb)
);

-- Service-role only (the generator runs server-side).
alter table suburb_intros enable row level security;

comment on table suburb_intros is 'Cached per-suburb intro copy for the suburb page generator.';
