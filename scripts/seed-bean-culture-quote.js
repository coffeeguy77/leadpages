#!/usr/bin/env node
/**
 * Seed Bean Culture online quote config onto slug=beanculture.
 * Idempotent — safe to re-run.
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/seed-bean-culture-quote.js
 *   node scripts/seed-bean-culture-quote.js --dry-run
 */
const { createClient } = require('@supabase/supabase-js');
const { BEAN_CULTURE_QUOTE_CONFIG } = require('../lib/quote-system/bean-culture-config');
const { CONFIG_CLASSIFICATION } = require('../lib/quote-system/constants');

const SITE_SLUG = 'beanculture';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!dryRun && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required (or use --dry-run)');
    process.exit(1);
  }

  if (dryRun) {
    console.log('Dry run — would seed quote system for slug:', SITE_SLUG);
    console.log('Classification:', CONFIG_CLASSIFICATION.PRIVATE_SUPERUSER);
    console.log('Products:', BEAN_CULTURE_QUOTE_CONFIG.products.map(function(p) { return p.label; }).join(', '));
    return;
  }

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: site, error: siteErr } = await sb.from('sites')
    .select('id,slug,business_name')
    .eq('slug', SITE_SLUG)
    .maybeSingle();

  if (siteErr) {
    console.error('Database error:', siteErr.message);
    process.exit(1);
  }
  if (!site) {
    console.error('Site not found for slug:', SITE_SLUG);
    process.exit(1);
  }

  console.log('Found site:', site.business_name, '(' + site.slug + ')');

  let { data: qs } = await sb.from('quote_systems')
    .select('*')
    .eq('site_id', site.id)
    .maybeSingle();

  if (!qs) {
    const { data: created, error } = await sb.from('quote_systems').insert({
      site_id: site.id,
      enabled: true,
      configuration_classification: CONFIG_CLASSIFICATION.PRIVATE_SUPERUSER
    }).select('*').single();
    if (error) {
      console.error('Failed to create quote_systems row:', error.message);
      process.exit(1);
    }
    qs = created;
    console.log('Created quote_systems row:', qs.id);
  } else {
    const { error } = await sb.from('quote_systems').update({
      enabled: true,
      configuration_classification: CONFIG_CLASSIFICATION.PRIVATE_SUPERUSER,
      updated_at: new Date().toISOString()
    }).eq('id', qs.id);
    if (error) {
      console.error('Failed to update quote_systems:', error.message);
      process.exit(1);
    }
    console.log('Updated quote_systems row:', qs.id);
  }

  const { data: latest } = await sb.from('quote_system_config_versions')
    .select('version_number,config')
    .eq('quote_system_id', qs.id)
    .order('version_number', { ascending: false })
    .limit(1);

  const nextVersion = (latest && latest[0] ? latest[0].version_number : 0) + 1;
  const existingConfig = latest && latest[0] ? latest[0].config : null;
  const configJson = JSON.stringify(BEAN_CULTURE_QUOTE_CONFIG);
  const existingJson = existingConfig ? JSON.stringify(existingConfig) : '';

  if (existingJson === configJson && qs.active_config_version_id) {
    console.log('Config unchanged — skipping new version.');
    console.log('Done. Active config version already matches Bean Culture seed.');
    return;
  }

  const { data: version, error: verErr } = await sb.from('quote_system_config_versions').insert({
    quote_system_id: qs.id,
    version_number: nextVersion,
    label: 'Bean Culture Coffee Cart Hire',
    config: BEAN_CULTURE_QUOTE_CONFIG
  }).select('*').single();

  if (verErr) {
    console.error('Failed to insert config version:', verErr.message);
    process.exit(1);
  }

  const { error: ptrErr } = await sb.from('quote_systems')
    .update({ active_config_version_id: version.id, updated_at: new Date().toISOString() })
    .eq('id', qs.id);

  if (ptrErr) {
    console.error('Failed to set active config:', ptrErr.message);
    process.exit(1);
  }

  console.log('Seeded config version', version.version_number, '(' + version.id + ')');
  console.log('Done. Bean Culture quote system is private_superuser on', SITE_SLUG);
}

main().catch(function(e) {
  console.error(e);
  process.exit(1);
});
