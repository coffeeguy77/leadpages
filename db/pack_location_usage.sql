-- Tracks which trade-pack variants have been used at which target locations.
-- Prevents duplicate SEO content for the same trade + location combination.

CREATE TABLE IF NOT EXISTS pack_location_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL,
  pack_slug text NOT NULL,
  pack_variant int NOT NULL DEFAULT 1,
  location_slug text NOT NULL,
  location_label text NOT NULL,
  content_hash text,
  partner_id uuid,
  site_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pack_id, location_slug)
);

CREATE INDEX IF NOT EXISTS pack_location_usage_slug_loc_idx
  ON pack_location_usage (pack_slug, location_slug);

CREATE INDEX IF NOT EXISTS pack_location_usage_partner_idx
  ON pack_location_usage (partner_id);

ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS content_hash text;
