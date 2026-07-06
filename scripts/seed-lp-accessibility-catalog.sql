-- Marketplace directory card for Appearance & Accessibility (run once in Supabase SQL editor)
-- Requires a catalog category; creates "Site Tools" if missing.

INSERT INTO catalog_categories (id, name, slug, sort_order)
VALUES (
  'site-tools',
  'Site Tools',
  'site-tools',
  50
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  sort_order = EXCLUDED.sort_order;

INSERT INTO catalog_features (
  id,
  slug,
  name,
  tagline,
  summary,
  category_id,
  badge,
  sort_order,
  marketplace_status
) VALUES (
  'appearance-accessibility',
  'appearance-accessibility',
  'Appearance & Accessibility',
  'Themes, visitor viewing preferences, and WCAG 2.2-focused accessibility support.',
  'Give visitors control over text size, contrast, motion, and spacing. Configure per-site defaults, optional floating accessibility button, skip links, and published-page theme overlays.',
  'site-tools',
  'Included',
  5,
  'live'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  summary = EXCLUDED.summary,
  category_id = EXCLUDED.category_id,
  badge = EXCLUDED.badge,
  marketplace_status = EXCLUDED.marketplace_status,
  sort_order = EXCLUDED.sort_order;
