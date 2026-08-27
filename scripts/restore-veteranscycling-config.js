#!/usr/bin/env node
/**
 * Restore veteranscycling Trust Bar + Scrolling Sponsor Banner after a config revert.
 *
 * Merges sponsor tiles from playground/ssb-veterans-cycling.json and re-enables
 * the Facebook trust badge. Creates a site_backups row before overwriting.
 *
 * Usage:
 *   node scripts/restore-veteranscycling-config.js [--dry-run] [--slug=veteranscycling]
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SITE_ID = 'c731b307-6c36-4dab-8642-fef77153b23c';
const DEFAULT_SLUG = 'veteranscycling';
const FACEBOOK_GROUP = 'https://www.facebook.com/groups/invictusaustraliaact/';

function parseArgs() {
  const out = { dryRun: false, slug: DEFAULT_SLUG };
  process.argv.slice(2).forEach(function (arg) {
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg.indexOf('--slug=') === 0) out.slug = arg.slice(7).trim() || DEFAULT_SLUG;
  });
  return out;
}

function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

function loadSsbPreset() {
  const presetPath = path.join(__dirname, '../playground/ssb-veterans-cycling.json');
  const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
  const ssb = preset.site_config && preset.site_config.sections && preset.site_config.sections.scrollingSponsorBanner;
  if (!ssb) throw new Error('ssb-veterans-cycling.json missing scrollingSponsorBanner section');
  return deepClone(ssb);
}

function trustBarRestore() {
  return {
    on: true,
    mode: 'badges',
    badges: [{
      on: true,
      label: 'Visit facebook for latest news on the event',
      linkAction: 'url',
      linkUrl: FACEBOOK_GROUP
    }]
  };
}

function mergeSectionOrder(order, keys) {
  const out = Array.isArray(order) ? order.slice() : [];
  keys.forEach(function (key) {
    if (out.indexOf(key) < 0) out.push(key);
  });
  return out;
}

function pinOrderAfterHero(order) {
  const list = order.slice();
  ['trustBar', 'scrollingSponsorBanner'].forEach(function (key) {
    const idx = list.indexOf(key);
    if (idx >= 0) list.splice(idx, 1);
  });
  const heroes = ['hero', 'heroSlider', 'heroBeforeAfter', 'splitHero'];
  let hi = -1;
  for (let i = 0; i < list.length; i++) {
    if (heroes.indexOf(list[i]) >= 0) { hi = i; break; }
  }
  const insertAt = hi >= 0 ? hi + 1 : 0;
  list.splice(insertAt, 0, 'trustBar', 'scrollingSponsorBanner');
  return list;
}

async function ensureSiteApp(sb, siteId, sectionKey, positionSlot, positionOrder) {
  const { data: reg, error: regErr } = await sb.from('app_registry')
    .select('id,section_key,default_position')
    .eq('section_key', sectionKey)
    .maybeSingle();
  if (regErr) throw regErr;
  if (!reg) {
    console.warn('No app_registry row for', sectionKey, '— config restored but marketplace row not updated');
    return;
  }
  const { error } = await sb.from('site_apps').upsert({
    site_id: siteId,
    app_id: reg.id,
    enabled: true,
    position_slot: positionSlot || reg.default_position || 'upper',
    position_order: positionOrder || 0
  }, { onConflict: 'site_id,app_id' });
  if (error) throw error;
  console.log('site_apps enabled:', sectionKey);
}

async function main() {
  const opts = parseArgs();
  if (!opts.dryRun && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    process.exit(1);
  }

  const ssb = loadSsbPreset();
  const trustBar = trustBarRestore();

  if (opts.dryRun) {
    console.log('Dry run — would restore for slug', opts.slug);
    console.log('trustBar badges:', trustBar.badges.length);
    console.log('SSB instances:', (ssb.instances || []).length);
    console.log('SSB tiles:', ((ssb.instances && ssb.instances[0] && ssb.instances[0].tiles) || []).length);
    return;
  }

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: site, error: siteErr } = await sb.from('sites')
    .select('id,slug,business_name,config,status')
    .eq('slug', opts.slug)
    .maybeSingle();
  if (siteErr) throw siteErr;
  if (!site) {
    console.error('Site not found for slug:', opts.slug);
    process.exit(1);
  }
  if (site.id !== SITE_ID) {
    console.warn('Warning: site id', site.id, 'differs from expected veterans id', SITE_ID);
  }

  const cfg = deepClone(site.config || {});
  if (!cfg.sections) cfg.sections = {};

  cfg.sections.trustBar = Object.assign({}, cfg.sections.trustBar || {}, trustBar);
  cfg.sections.scrollingSponsorBanner = Object.assign({}, ssb, { on: true });

  let order = mergeSectionOrder(cfg.sectionOrder, ['heroSlider', 'trustBar', 'scrollingSponsorBanner', 'textBox', 'promotions']);
  order = pinOrderAfterHero(order);
  cfg.sectionOrder = order;

  const backupLabel = 'Before veteranscycling restore ' + new Date().toISOString().slice(0, 10);
  const { error: bkErr } = await sb.from('site_backups').insert({
    site_id: site.id,
    label: backupLabel,
    source: 'pre_restore',
    config: site.config || {},
    created_by: null
  });
  if (bkErr) {
    console.warn('Could not create backup row (table may be missing):', bkErr.message);
  } else {
    console.log('Safety backup saved:', backupLabel);
  }

  const { error: upErr } = await sb.from('sites').update({
    config: cfg,
    updated_at: new Date().toISOString()
  }).eq('id', site.id);
  if (upErr) throw upErr;

  await ensureSiteApp(sb, site.id, 'trustBar', 'upper', 1);
  await ensureSiteApp(sb, site.id, 'scrollingSponsorBanner', 'upper', 2);

  console.log('Restored config for', site.slug, '(' + site.id + ')');
  console.log('sectionOrder:', cfg.sectionOrder.join(', '));
  console.log('Publish/cache: purge CDN or wait for cache expiry, or open manage and Publish Live Site.');
}

main().catch(function (e) {
  console.error(e && e.message || e);
  process.exit(1);
});
