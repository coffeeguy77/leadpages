-- Partner quotes: run once in Supabase SQL editor (view tracking + limited-time offers)

ALTER TABLE partner_quotes ADD COLUMN IF NOT EXISTS client_viewed_at timestamptz;
ALTER TABLE partner_quotes ADD COLUMN IF NOT EXISTS client_last_viewed_at timestamptz;
ALTER TABLE partner_quotes ADD COLUMN IF NOT EXISTS client_view_count integer NOT NULL DEFAULT 0;

ALTER TABLE partner_quotes ADD COLUMN IF NOT EXISTS offer_discount_pct integer;
ALTER TABLE partner_quotes ADD COLUMN IF NOT EXISTS offer_hours integer;
ALTER TABLE partner_quotes ADD COLUMN IF NOT EXISTS offer_started_at timestamptz;
ALTER TABLE partner_quotes ADD COLUMN IF NOT EXISTS offer_expires_at timestamptz;
