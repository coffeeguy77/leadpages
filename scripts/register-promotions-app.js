#!/usr/bin/env node
/**
 * Register / heal the Promotions & Offers marketplace app in app_registry.
 * Remaps stale promotions-hero / promotions-inline rows to sections.promotions.
 * Does not enable it on any site — that is done per-tenant via App Marketplace.
 *
 * Usage: node scripts/register-promotions-app.js [--dry-run]
 */
const { createClient } = require('@supabase/supabase-js');

const SECTION_KEY = 'promotions';
const STALE_KEYS = ['promotions-hero', 'promotions-inline'];
const APP = {
  name: 'Promotions & Offers',
  slug: 'promotions',
  section_key: SECTION_KEY,
  tier: 'free',
  price_monthly_aud: 0,
  price_annual_aud: 0,
  tagline: 'Seasonal offers, front and centre',
  description:
    'Urgency offers with types, placements and styles — weekly windows, deadlines, '
    + 'limited spots, finance, suburb specials and more. Same Promotions Engine as the Page editor.',
  default_position: 'mid',
  marketplace_status: 'live',
  builder_visible: true,
  can_reposition: true,
  hero_exclusive: false,
  sort_order: 85
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!dryRun && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    process.exit(1);
  }
  if (dryRun) {
    console.log('Would register app:', APP);
    console.log('Would retire section_keys:', STALE_KEYS);
    return;
  }

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const row = Object.assign({}, APP, { updated_at: new Date().toISOString() });

  const { data: related, error: listErr } = await sb.from('app_registry')
    .select('id,slug,section_key,name,marketplace_status,builder_visible')
    .in('section_key', [SECTION_KEY].concat(STALE_KEYS));
  if (listErr) { console.error(listErr.message); process.exit(1); }

  const list = related || [];
  const byKey = {};
  list.forEach(function(a) { byKey[a.section_key] = a; });
  const primary = byKey[SECTION_KEY] || byKey['promotions-hero'] || null;

  if (!primary) {
    const { data, error } = await sb.from('app_registry').insert(row).select('id').single();
    if (error) { console.error(error.message); process.exit(1); }
    console.log('Inserted app_registry:', data.id);
  } else {
    const { error } = await sb.from('app_registry').update(row).eq('id', primary.id);
    if (error) { console.error(error.message); process.exit(1); }
    console.log('Updated app_registry:', primary.id, '(' + primary.section_key + ' → promotions)');
  }

  const primaryId = primary && primary.id;
  for (const s of list) {
    if (primaryId && s.id === primaryId) continue;
    if (STALE_KEYS.indexOf(s.section_key) < 0) continue;
    const { error } = await sb.from('app_registry').update({
      marketplace_status: 'draft',
      builder_visible: false,
      updated_at: row.updated_at
    }).eq('id', s.id);
    if (error) { console.error(error.message); process.exit(1); }
    console.log('Retired stale app:', s.slug, s.id);
  }

  console.log('Done. Public page: /marketplace/promotions — toggle from App Marketplace in manage.');
}

main().catch(function(e) { console.error(e); process.exit(1); });
