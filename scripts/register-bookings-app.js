#!/usr/bin/env node
/**
 * Register Bookings (bookingStorefront) in app_registry.
 * Usage: node scripts/register-bookings-app.js
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
'use strict';

const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const sb = createClient(url, key);
  const row = {
    slug: 'bookings',
    name: 'Bookings',
    section_key: 'bookingStorefront',
    tagline: 'Appointments, classes and visits',
    description: 'Appointments, classes, on-site visits and resource hire — native LeadPages scheduling.',
    tier: 'free',
    price_monthly_aud: 0,
    price_annual_aud: 0,
    default_position: 'mid',
    marketplace_status: 'live',
    builder_visible: true,
    can_reposition: true,
    hero_exclusive: false,
    sort_order: 88
  };
  const { data: existing } = await sb.from('app_registry').select('id').eq('slug', 'bookings').maybeSingle();
  if (existing) {
    const { error } = await sb.from('app_registry').update(row).eq('id', existing.id);
    if (error) throw error;
    console.log('Updated app_registry bookings');
  } else {
    const { error } = await sb.from('app_registry').insert(row);
    if (error) throw error;
    console.log('Inserted app_registry bookings');
  }
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
