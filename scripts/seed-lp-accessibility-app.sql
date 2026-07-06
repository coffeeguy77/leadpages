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
  'Appearance & Accessibility',
  'appearance-accessibility',
  'lpAccessibility',
  'free',
  'Themes, visitor viewing preferences, and WCAG 2.2-focused accessibility support.',
  'Configure published-page themes, visitor viewing preferences, skip links, and the accessibility floating button from Appearance & Accessibility in the command centre.',
  'footer',
  'live',
  true,
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
