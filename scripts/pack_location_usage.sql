-- Tracks which trade-pack variants have been used at which target locations.
-- Prevents duplicate SEO content for the same trade + location combination.
-- service_packs is keyed by slug (no id column) — usage rows use slug + variant.

CREATE TABLE IF NOT EXISTS pack_location_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_slug text NOT NULL,
  pack_variant int NOT NULL DEFAULT 1,
  location_slug text NOT NULL,
  location_label text NOT NULL,
  content_hash text,
  partner_id uuid,
  site_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pack_slug, pack_variant, location_slug)
);

CREATE INDEX IF NOT EXISTS pack_location_usage_slug_loc_idx
  ON pack_location_usage (pack_slug, location_slug);

CREATE INDEX IF NOT EXISTS pack_location_usage_partner_idx
  ON pack_location_usage (partner_id);

ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS variant int NOT NULL DEFAULT 1;
