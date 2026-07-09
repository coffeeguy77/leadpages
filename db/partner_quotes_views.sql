-- Client view tracking for partner quotes (run once in Supabase SQL editor)
ALTER TABLE partner_quotes ADD COLUMN IF NOT EXISTS client_viewed_at timestamptz;
ALTER TABLE partner_quotes ADD COLUMN IF NOT EXISTS client_last_viewed_at timestamptz;
ALTER TABLE partner_quotes ADD COLUMN IF NOT EXISTS client_view_count integer NOT NULL DEFAULT 0;
