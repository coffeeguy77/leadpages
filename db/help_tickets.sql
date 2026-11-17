-- Help Centre paid-help / human-assist tickets (optional — API soft-fails if missing).
create table if not exists help_tickets (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  site_id uuid references public.sites(id) on delete set null,
  topic_id text,
  topic_title text,
  urgency text not null default 'normal',
  message text not null,
  path text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists help_tickets_created_idx on help_tickets (created_at desc);
create index if not exists help_tickets_status_idx on help_tickets (status);
create index if not exists help_tickets_site_idx on help_tickets (site_id);

alter table help_tickets enable row level security;

-- Service role writes from API. Authenticated users can read their own tickets.
drop policy if exists help_tickets_select_own on help_tickets;
create policy help_tickets_select_own on help_tickets
  for select to authenticated
  using (auth.uid() = user_id);

comment on table help_tickets is 'Customer Help Centre paid-help requests from Manage overlay';
