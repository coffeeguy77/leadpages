-- Register the Map & Hours (mapHours) and CTA Banner (ctaBanner) marketplace apps.
-- Optional: /api/api-apps registers both automatically the first time the marketplace
-- list loads. Run this in the Supabase SQL editor to register them straight away.
-- Safe to re-run: rows that already exist (by section_key) are left unchanged.

INSERT INTO app_registry (
  name, slug, section_key, tier, price_monthly_aud, price_annual_aud, tagline, description,
  default_position, marketplace_status, builder_visible, can_reposition, hero_exclusive,
  sort_order, updated_at
)
SELECT v.* FROM (VALUES
  (
    'Map & Hours', 'map-hours', 'mapHours', 'free', 0, 0,
    'Find us: address, live map and opening hours',
    'Address with a pinned Google map (look the address up in the editor), opening hours, phone number and a "Get directions" button. Off by default; enable from App Marketplace or Page editor.',
    'lower', 'live', true, true, false, 76, now()
  ),
  (
    'CTA Banner', 'cta-banner', 'ctaBanner', 'free', 0, 0,
    'A bold call to action with one or two buttons',
    'Heading, short text and up to two buttons. Each button can open the booking calendar, call, go to the quote form, scroll to an app or open a link. Brand, dark, light or photo styles.',
    'lower', 'live', true, true, false, 77, now()
  )
) AS v(name, slug, section_key, tier, price_monthly_aud, price_annual_aud, tagline, description,
       default_position, marketplace_status, builder_visible, can_reposition, hero_exclusive,
       sort_order, updated_at)
WHERE NOT EXISTS (SELECT 1 FROM app_registry a WHERE a.section_key = v.section_key);
