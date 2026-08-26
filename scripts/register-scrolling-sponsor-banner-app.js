#!/usr/bin/env node
/**
 * Register / heal the Scrolling Sponsor Banner marketplace app in app_registry.
 * Does not enable it on any site — that is done per-tenant via App Marketplace.
 *
 * Usage: node scripts/register-scrolling-sponsor-banner-app.js [--dry-run]
 */
const { createClient } = require('@supabase/supabase-js');

const SECTION_KEY = 'scrollingSponsorBanner';
const APP = {
  name: 'Scrolling Sponsor Banner',
  slug: 'scrolling-sponsor-banner',
  section_key: SECTION_KEY,
  tier: 'free',
  price_monthly_aud: 0,
  price_annual_aud: 0,
  tagline: 'Sponsors and partners, always in motion',
  description:
    'Display sponsors, partners and brands in a seamless scrolling banner with optional '
    + 'links, text overlays and custom styling. Multiple named banners per site.',
  default_position: 'upper',
  marketplace_status: 'live',
  builder_visible: true,
  can_reposition: true,
  hero_exclusive: false,
  sort_order: 78
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!dryRun && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    process.exit(1);
  }
  if (dryRun) {
    console.log('Would register app:', APP);
    return;
  }

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const row = Object.assign({}, APP, { updated_at: new Date().toISOString() });

  const { data: existing, error: listErr } = await sb.from('app_registry')
    .select('id,slug,section_key,name,marketplace_status,builder_visible')
    .or('section_key.eq.' + SECTION_KEY + ',slug.eq.scrolling-sponsor-banner')
    .maybeSingle();
  if (listErr) { console.error(listErr.message); process.exit(1); }

  if (!existing) {
    const { data, error } = await sb.from('app_registry').insert(row).select('id').single();
    if (error) { console.error(error.message); process.exit(1); }
    console.log('Inserted app_registry:', data.id);
  } else {
    const { error } = await sb.from('app_registry').update(row).eq('id', existing.id);
    if (error) { console.error(error.message); process.exit(1); }
    console.log('Updated app_registry:', existing.id);
  }

  console.log('Done. Public page: /marketplace/scrolling-sponsor-banner — toggle from App Marketplace in manage.');
}

main().catch(function(e) { console.error(e); process.exit(1); });
