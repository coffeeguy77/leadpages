#!/usr/bin/env node
/**
 * Register the About Us marketplace app in app_registry (+ catalog seed).
 * Usage: node scripts/register-about-us-app.js [--dry-run] [--catalog]
 */
'use strict';

const SECTION_KEY = 'aboutUs';
const APP = {
  name: 'About Us',
  slug: 'about-us',
  section_key: SECTION_KEY,
  tier: 'free',
  price_monthly_aud: 0,
  price_annual_aud: 0,
  tagline: 'Three-column founder story with optional CTA band',
  description:
    'Tell the business story with a lead column, body copy, photo and quote — '
    + 'plus an optional navy call-to-action band underneath. Off by default; '
    + 'enable from App Marketplace or Page editor.',
  default_position: 'upper',
  marketplace_status: 'live',
  builder_visible: true,
  can_reposition: true,
  hero_exclusive: false,
  sort_order: 74
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const doCatalog = process.argv.includes('--catalog');
  if (dryRun) {
    console.log('Would register app:', APP);
    if (doCatalog) console.log('Would also seed catalog_features for aboutUs');
    return;
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    process.exit(1);
  }

  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: existing } = await sb
    .from('app_registry')
    .select('id')
    .eq('section_key', SECTION_KEY)
    .maybeSingle();

  const row = Object.assign({}, APP, { updated_at: new Date().toISOString() });

  if (existing) {
    const { error } = await sb.from('app_registry').update(row).eq('id', existing.id);
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    console.log('Updated app_registry:', existing.id);
  } else {
    const { data, error } = await sb.from('app_registry').insert(row).select('id').single();
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    console.log('Inserted app_registry:', data.id);
  }

  if (doCatalog) {
    const { seedMarketplaceCatalog } = require('../lib/marketplace-catalog-seed');
    const result = await seedMarketplaceCatalog(sb, { sectionKeys: [SECTION_KEY] });
    console.log('Catalog seed:', JSON.stringify(result, null, 2));
  }

  console.log('Done. Open App Marketplace → About Us (Upper zone), or Page editor → About Us.');
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
