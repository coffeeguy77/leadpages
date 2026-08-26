-- Register Scrolling Sponsor Banner marketplace app (safe to re-run).
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
  'Scrolling Sponsor Banner',
  'scrolling-sponsor-banner',
  'scrollingSponsorBanner',
  'free',
  'Sponsors and partners, always in motion',
  'Display sponsors, partners and brands in a seamless scrolling banner with optional links, text overlays and custom styling. Multiple named banners per site.',
  'upper',
  'live',
  true,
  true,
  false,
  78,
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
  hero_exclusive = EXCLUDED.hero_exclusive,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
