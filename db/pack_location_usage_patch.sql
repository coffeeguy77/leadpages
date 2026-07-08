-- Patch: run this if you already imported an older pack_location_usage.sql
-- that required service_packs.id / pack_id uuid.
--
-- Safe to run multiple times.

-- Drop old pack_id-based unique constraint if present
ALTER TABLE pack_location_usage DROP CONSTRAINT IF EXISTS pack_location_usage_pack_id_location_slug_key;

-- pack_id is optional (legacy); slug+variant is the real key
ALTER TABLE pack_location_usage DROP COLUMN IF EXISTS pack_id;

-- Ensure slug+variant+location uniqueness
ALTER TABLE pack_location_usage DROP CONSTRAINT IF EXISTS pack_location_usage_slug_variant_loc_unique;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pack_location_usage_slug_variant_loc_unique'
  ) THEN
    ALTER TABLE pack_location_usage
      ADD CONSTRAINT pack_location_usage_slug_variant_loc_unique
      UNIQUE (pack_slug, pack_variant, location_slug);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pack_location_usage_slug_loc_idx
  ON pack_location_usage (pack_slug, location_slug);

ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE service_packs ADD COLUMN IF NOT EXISTS variant int NOT NULL DEFAULT 1;
