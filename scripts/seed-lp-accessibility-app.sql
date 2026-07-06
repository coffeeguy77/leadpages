-- Phase 3: register lpAccessibility marketplace app (run once in Supabase SQL editor)
-- Safe to re-run: uses ON CONFLICT on slug if unique constraint exists.

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
  'Accessibility Suite',
  'accessibility-suite',
  'lpAccessibility',
  'free',
  'Visitor viewing preferences and accessibility controls',
  'Floating preferences widget, skip links, and published-page theme overlays. Configure defaults in Appearance & Accessibility.',
  'footer',
  'live',
  false,
  false,
  false,
  900,
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
  updated_at = now();
