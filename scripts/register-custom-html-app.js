#!/usr/bin/env node
/**
 * Register the Custom HTML marketplace app in app_registry.
 * Usage: node scripts/register-custom-html-app.js [--dry-run]
 */
const { createClient } = require('@supabase/supabase-js');

const SECTION_KEY = 'customHtml';
const APP = {
  name: 'Custom HTML',
  slug: 'custom-html',
  section_key: SECTION_KEY,
  tier: 'free',
  price_monthly_aud: 0,
  price_annual_aud: 0,
  tagline: 'Embed your own HTML, CSS and JS — fully responsive, not an iframe',
  description:
    'Drop custom HTML onto any page. Attach optional CSS and JavaScript URLs. '
    + 'Renders inline in your site layout so you can reposition it like any other app. '
    + 'Ideal for tools, calculators, and one-off widgets.',
  default_position: 'mid',
  marketplace_status: 'live',
  builder_visible: true,
  can_reposition: true,
  hero_exclusive: false,
  sort_order: 120
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('Would register app:', APP);
    return;
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    process.exit(1);
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
  console.log('Done. Enable via App Marketplace → Custom HTML, or seed-transfer-matcher-page.js');
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
