#!/usr/bin/env node
/**
 * Seed all marketplace catalog features, page blocks, app_registry rows and demo presets.
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/seed-marketplace-catalog.js           # seed all 37 apps
 *   node scripts/seed-marketplace-catalog.js --dry-run # preview keys only
 *   node scripts/seed-marketplace-catalog.js hero faq  # seed specific sections
 */
const { createClient } = require('@supabase/supabase-js');
const { seedMarketplaceCatalog } = require('../lib/marketplace-catalog-seed');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const sectionKeys = process.argv.slice(2).filter(function(a) {
    return a && !a.startsWith('-');
  });

  if (!dryRun && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required (or use --dry-run)');
    process.exit(1);
  }

  const sb = dryRun
    ? null
    : createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  console.log(dryRun ? 'Dry run — no database writes' : 'Seeding marketplace catalog…');
  const result = await seedMarketplaceCatalog(sb, { dryRun, sectionKeys: sectionKeys.length ? sectionKeys : undefined });

  if (dryRun) {
    console.log('Would seed', result.wouldSeed, 'apps:');
    result.sectionKeys.forEach(function(k) { console.log(' -', k); });
    return;
  }

  console.log('Categories upserted:', result.categories);
  console.log('Features seeded:', result.features.length);
  console.log('App registry rows:', result.apps);
  console.log('Demo presets:', result.presets);
  if (result.errors.length) {
    console.error('Errors:', result.errors.length);
    result.errors.forEach(function(e) { console.error(' ', e); });
    process.exit(1);
  }
  console.log('Done. Public pages: /marketplace/<slug> (e.g. /marketplace/hero)');
}

main().catch(function(e) {
  console.error(e);
  process.exit(1);
});
