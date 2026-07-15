-- db/event_daily.sql — daily rolled-up analytics (apply in Supabase SQL editor).
-- Keeps dashboard history after raw `events` older than ~90 days are deleted.

CREATE TABLE IF NOT EXISTS public.event_daily (
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  day date NOT NULL,
  event text NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  locations jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, day, event)
);

CREATE INDEX IF NOT EXISTS event_daily_day_idx ON public.event_daily (day DESC);
CREATE INDEX IF NOT EXISTS event_daily_site_day_idx ON public.event_daily (site_id, day DESC);

COMMENT ON TABLE public.event_daily IS
  'Per-site daily event counts. Populated by /api/cron/events-rollup from raw events older than retention.';
