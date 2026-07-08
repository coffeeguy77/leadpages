#!/usr/bin/env node
/**
 * Export a live site's section config as a playground preset JSON file.
 *
 * Usage:
 *   node scripts/export-site-preset.js --site beanculture --section instaGallery
 *   node scripts/export-site-preset.js --site beanculture --section igProjectFeed --out playground/beanculture-ig.json
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
 * Does not write to the database — prints/saves file JSON only.
 * To save into app_presets, use Marketplace Admin sync or POST /api/marketplace-playground sync_site.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const pp = require('../lib/playground-preset');
const demoSites = require('../lib/demo-sites');

const ROOT = path.join(__dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function extractSiteConfig(siteConfig, sectionKey) {
  const cfg = siteConfig || {};
  const sec = (cfg.sections && cfg.sections[sectionKey]) || cfg[sectionKey] || {};
  return pp.flatDemoToSiteConfig(
    Object.assign({}, cfg, { sections: { [sectionKey]: Object.assign({ on: true }, sec) } }),
    sectionKey
  );
}

async function main() {
  const siteSlug = (arg('site', '') || '').trim().toLowerCase();
  const sectionKey = (arg('section', '') || '').trim();
  const presetSlug = (arg('preset', siteSlug + '-' + sectionKey) || '').trim();
  const label = arg('label', '');
  const outPath = arg('out', '');

  if (!siteSlug || !sectionKey) {
    console.error('Usage: node scripts/export-site-preset.js --site <slug> --section <section_key> [--out path] [--preset slug] [--label name]');
    process.exit(1);
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    console.error('Tip: registered demo sites:', Object.keys(demoSites.listDemoSites()).join(', '));
    process.exit(1);
  }

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: site, error } = await sb.from('sites')
    .select('id,slug,business_name,config')
    .eq('slug', siteSlug)
    .maybeSingle();

  if (error) {
    console.error('Database error:', error.message);
    process.exit(1);
  }
  if (!site) {
    console.error('Site not found:', siteSlug);
    process.exit(1);
  }

  const siteConfig = extractSiteConfig(site.config, sectionKey);
  const preset = pp.normalizePreset(
    pp.dbConfigFromSiteConfig(sectionKey, siteConfig),
    {
      slug: presetSlug,
      label: label || (site.business_name + ' — ' + sectionKey),
      source: 'file',
      section_key: sectionKey
    }
  );
  const fileJson = pp.fileJsonFromPreset(preset);

  if (outPath) {
    const abs = path.isAbsolute(outPath) ? outPath : path.join(ROOT, outPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(fileJson, null, 2) + '\n');
    console.log('Wrote', path.relative(ROOT, abs));
  } else {
    process.stdout.write(JSON.stringify(fileJson, null, 2) + '\n');
  }

  console.error('');
  console.error('Site:', site.slug, '(' + site.business_name + ')');
  console.error('Section:', sectionKey);
  console.error('Preset slug:', presetSlug);
  console.error('To register for marketplace pages, add apps to marketplace/demo-sites.json or POST sync_site to save as app_presets.');
}

main().catch(function(e) {
  console.error(e);
  process.exit(1);
});
