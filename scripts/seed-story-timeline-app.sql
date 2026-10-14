-- Register the Timeline (storyTimeline) marketplace app.
-- Optional: /api/api-apps registers it automatically the first time the marketplace
-- list loads. Run this in the Supabase SQL editor to register it straight away.
-- Safe to re-run: nothing changes if a row with this section_key already exists.

INSERT INTO app_registry (
  name, slug, section_key, tier, price_monthly_aud, price_annual_aud, tagline, description,
  default_position, marketplace_status, builder_visible, can_reposition, hero_exclusive,
  sort_order, updated_at
)
SELECT
  'Timeline', 'story-timeline', 'storyTimeline', 'free', 0, 0,
  'Your story in milestones: year, title and a short line',
  'Show how the business got here — or how a job, product or partnership comes together. Line, alternating, side rail or photo-card layouts, with ring, dot, icon or year markers. Off by default; enable from App Marketplace or Page editor.',
  'lower', 'live', true, true, false, 78, now()
WHERE NOT EXISTS (SELECT 1 FROM app_registry a WHERE a.section_key = 'storyTimeline');
