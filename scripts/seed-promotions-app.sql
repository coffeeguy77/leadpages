-- Register unified Promotions & Offers marketplace app (safe to re-run).
-- Remaps stale promotions-hero / promotions-inline rows to sections.promotions.
-- Does not enable the app on any site — tenants toggle it from App Marketplace.

-- 1) Promote promotions-hero (or insert) to the canonical Promotions & Offers app.
INSERT INTO app_registry (
  name,
  slug,
  section_key,
  tier,
  tagline,
  description,
  default_position,
  marketplace_status,
  builder_visible,
  can_reposition,
  hero_exclusive,
  sort_order,
  updated_at
) VALUES (
  'Promotions & Offers',
  'promotions',
  'promotions',
  'free',
  'Seasonal offers, front and centre',
  'Urgency offers with types, placements and styles — weekly windows, deadlines, limited spots, finance, suburb specials and more. Same Promotions Engine as the Page editor.',
  'mid',
  'live',
  true,
  true,
  false,
  85,
  now()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  section_key = EXCLUDED.section_key,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  default_position = EXCLUDED.default_position,
  marketplace_status = EXCLUDED.marketplace_status,
  builder_visible = EXCLUDED.builder_visible,
  can_reposition = EXCLUDED.can_reposition,
  updated_at = now();

-- 2) If an old promotions-hero row still exists under its old slug, remap it in place
--    (preserves site_apps foreign keys) then hide any leftover inline split.
UPDATE app_registry
SET
  name = 'Promotions & Offers',
  slug = 'promotions',
  section_key = 'promotions',
  tagline = 'Seasonal offers, front and centre',
  description = 'Urgency offers with types, placements and styles — weekly windows, deadlines, limited spots, finance, suburb specials and more. Same Promotions Engine as the Page editor.',
  default_position = 'mid',
  marketplace_status = 'live',
  builder_visible = true,
  can_reposition = true,
  hero_exclusive = false,
  sort_order = 85,
  updated_at = now()
WHERE section_key = 'promotions-hero'
  AND NOT EXISTS (
    SELECT 1 FROM app_registry WHERE section_key = 'promotions' OR slug = 'promotions'
  );

UPDATE app_registry
SET
  marketplace_status = 'draft',
  builder_visible = false,
  updated_at = now()
WHERE section_key IN ('promotions-hero', 'promotions-inline')
   OR slug IN ('promotions-hero', 'promotions-inline');
