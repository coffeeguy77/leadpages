-- Limited-time buy-now offer fields on partner quotes (run once in Supabase)
ALTER TABLE partner_quotes ADD COLUMN IF NOT EXISTS offer_discount_pct integer;
ALTER TABLE partner_quotes ADD COLUMN IF NOT EXISTS offer_hours integer;
ALTER TABLE partner_quotes ADD COLUMN IF NOT EXISTS offer_started_at timestamptz;
ALTER TABLE partner_quotes ADD COLUMN IF NOT EXISTS offer_expires_at timestamptz;
