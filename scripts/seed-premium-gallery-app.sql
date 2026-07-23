-- Register Premium Gallery marketplace app (safe to re-run).
-- Does not enable the app on any site — tenants toggle it from App Marketplace.

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
  'Premium Gallery',
  'premium-gallery',
  'premiumGallery',
  'free',
  'Design-led image galleries for large photo collections',
  'Showcase mixed portrait and landscape photography with mosaic layouts, filters, categories and albums. Off by default — enable from App Marketplace.',
  'upper',
  'live',
  true,
  true,
  false,
  88,
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
