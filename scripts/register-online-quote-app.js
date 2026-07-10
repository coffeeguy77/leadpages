#!/usr/bin/env node
/**
 * Register the onlineQuote marketplace app in app_registry.
 * Does not enable it on any site — that is done per-tenant via site_apps.
 *
 * Usage: node scripts/register-online-quote-app.js [--dry-run]
 */
const { createClient } = require('@supabase/supabase-js');

const SECTION_KEY = 'onlineQuote';
const APP = {
  name: 'Online Quote System',
  slug: 'online-quote',
  section_key: SECTION_KEY,
  tier: 'paid',
  tagline: 'Verified online quotes with gated pricing',
  description: 'Multi-step quote wizard with email and SMS verification. Server-side pricing, CRM integration, and immutable quote versions.',
  default_position: 'mid',
  marketplace_status: 'live',
  builder_visible: true,
  can_reposition: true,
  hero_exclusive: false,
  sort_order: 95
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
  const { data: existing } = await sb.from('app_registry')
    .select('id')
    .eq('section_key', SECTION_KEY)
    .maybeSingle();

  const row = Object.assign({}, APP, { updated_at: new Date().toISOString() });

  if (existing) {
    const { error } = await sb.from('app_registry').update(row).eq('id', existing.id);
    if (error) { console.error(error.message); process.exit(1); }
    console.log('Updated app_registry:', existing.id);
  } else {
    const { data, error } = await sb.from('app_registry').insert(row).select('id').single();
    if (error) { console.error(error.message); process.exit(1); }
    console.log('Inserted app_registry:', data.id);
  }
  console.log('Done. Embed: <div id="lp-online-quote" data-slug="YOUR_SLUG"></div>');
}

main().catch(function(e) { console.error(e); process.exit(1); });
