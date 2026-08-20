#!/usr/bin/env node
/**
 * Register Order Storefront in app_registry so the landing Apps picker
 * can assign it Shared / Unique like other marketplace apps.
 *
 * Usage:
 *   node scripts/register-order-storefront-app.js --dry-run
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/register-order-storefront-app.js
 */
'use strict';

const dryRun = process.argv.includes('--dry-run');

const PAYLOAD = {
  slug: 'order-storefront',
  name: 'Order Storefront',
  description:
    'Product catalogue, cart, and checkout embedded in the site theme. Place via Position; customers can SMS sign-in from the portal link to view past orders.',
  category: 'commerce',
  status: 'active',
  version: '1.0.0',
  icon_url: null,
  thumbnail_url: null,
  tags: ['orders', 'commerce', 'checkout', 'menu', 'catalogue'],
  requires_plan: null,
  config_schema: {
    type: 'object',
    properties: {
      eyebrow: { type: 'string' },
      heading: { type: 'string' },
      intro: { type: 'string' },
      showPortalLink: { type: 'boolean' },
      portalCtaLabel: { type: 'string' },
    },
  },
  default_config: {
    eyebrow: 'Order online',
    heading: 'Browse the menu',
    intro: 'Add items to your cart and checkout securely.',
    showPortalLink: true,
    portalCtaLabel: 'Sign in to view orders',
  },
  entry_type: 'embed',
  entry_ref: 'orderStorefront',
  scopes: ['site:read', 'orders:write'],
  installable: true,
  featured: true,
  sort_order: 40,
  metadata: {
    sectionKey: 'orderStorefront',
    editorPanel: 'orderStorefront',
    themeSection: true,
  },
};

async function main() {
  if (dryRun) {
    console.log(JSON.stringify(PAYLOAD, null, 2));
    return;
  }

  let createClient;
  try {
    ({ createClient } = require('@supabase/supabase-js'));
  } catch (e) {
    console.error('Missing @supabase/supabase-js. Install deps or use --dry-run.');
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or use --dry-run).');
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb.from('app_registry').upsert(PAYLOAD, { onConflict: 'slug' }).select('*').single();
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log('Registered:', data.slug, data.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
