#!/usr/bin/env node
/**
 * Register the Premium SEO marketplace app in app_registry.
 * Does not enable it on any site — that is done per-tenant via checkout / site_apps.
 *
 * Usage: node scripts/register-premium-seo-app.js [--dry-run]
 */
const { createClient } = require('@supabase/supabase-js');

const SECTION_KEY = 'premiumSeo';
const APP = {
  name: 'Premium SEO',
  slug: 'premium-seo',
  section_key: SECTION_KEY,
  tier: 'paid',
  price_monthly_aud: 49,
  price_annual_aud: 490,
  tagline: 'Live competitor research, keyword gap, backlinks & paid ads',
  description:
    'Unlock DataForSEO-powered Competition Analysis: find organic rivals for your domain, discover from industry keywords, keyword gap (Missing / Weak / Shared), backlink strategy, and competitor paid keywords. Manual competitor lists stay free for every site.',
  default_position: 'mid',
  marketplace_status: 'live',
  builder_visible: false,
  can_reposition: false,
  hero_exclusive: false,
  sort_order: 88
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
  console.log('Done. Sites purchase via Manage → Competition (Get Premium SEO) or App Marketplace checkout.');
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
