#!/usr/bin/env node
/**
 * Enable Custom HTML + create landing page /account-transaction-match
 * with the Transfer Matcher pack embedded (published).
 *
 * Usage:
 *   node scripts/seed-transfer-matcher-page.js --site=beanculture
 *   node scripts/seed-transfer-matcher-page.js --site=beanculture --dry-run
 *   node scripts/seed-transfer-matcher-page.js --site=beanculture --slug=account-transaction-matcher
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DEFAULT_SLUG = 'account-transaction-match';
const LEGACY_SLUG = 'account-transaction-matcher';
const SECTION_KEY = 'customHtml';

function arg(name, fallback) {
  const hit = process.argv.find(function (a) {
    return a === '--' + name || a.startsWith('--' + name + '=');
  });
  if (!hit) return fallback;
  if (hit.includes('=')) return hit.split('=').slice(1).join('=');
  const ix = process.argv.indexOf(hit);
  return process.argv[ix + 1] || fallback;
}

function matcherPack() {
  const root = path.join(__dirname, '../assets/apps/transfer-matcher');
  const html = fs.readFileSync(path.join(root, 'body.html'), 'utf8');
  return {
    on: true,
    title: '',
    fullBleed: true,
    bg: '#f9f9f7',
    html: html,
    cssUrls: ['/assets/apps/transfer-matcher/app.css'],
    jsUrls: ['/assets/apps/transfer-matcher/app.js']
  };
}

function buildPage(slug, pack) {
  return {
    slug: slug,
    title: 'Inter-Account Transfer Matcher',
    h1: '',
    body: '',
    metaDesc: 'Match inter-account bank transfers from Xero CSV exports or screenshots.',
    status: 'published',
    pageApps: [{ key: SECTION_KEY, mode: 'unique' }],
    pageSections: { customHtml: pack },
    pageLayoutOrder: [SECTION_KEY]
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const siteSlug = arg('site', process.env.SITE_SLUG || '');
  const pageSlug = arg('slug', DEFAULT_SLUG);
  if (!siteSlug) {
    console.error('Pass --site=<slug>');
    process.exit(1);
  }
  if (!dryRun && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    process.exit(1);
  }

  const pack = matcherPack();
  const page = buildPage(pageSlug, pack);

  if (dryRun) {
    console.log('Would upsert page on site', siteSlug, page.slug, 'status=' + page.status);
    console.log('customHtml html chars', pack.html.length, 'css', pack.cssUrls, 'js', pack.jsUrls);
    return;
  }

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Ensure app_registry row
  const { data: app, error: appErr } = await sb
    .from('app_registry')
    .select('id, section_key')
    .eq('section_key', SECTION_KEY)
    .maybeSingle();
  if (appErr) throw appErr;
  if (!app) {
    console.error('Custom HTML app not in app_registry. Run: node scripts/register-custom-html-app.js');
    process.exit(1);
  }

  const { data: site, error: siteErr } = await sb
    .from('sites')
    .select('id, slug, config')
    .eq('slug', siteSlug)
    .maybeSingle();
  if (siteErr) throw siteErr;
  if (!site) {
    console.error('Site not found:', siteSlug);
    process.exit(1);
  }

  const cfg = site.config && typeof site.config === 'object' ? site.config : {};
  if (!cfg.sections) cfg.sections = {};
  // Keep homepage customHtml off unless already on; page uses unique pageSections
  if (!cfg.sections.customHtml) {
    cfg.sections.customHtml = Object.assign({}, pack, { on: false, html: '' });
  }

  let pages = Array.isArray(cfg.pages) ? cfg.pages.slice() : [];

  // If seeding the short slug, retire the legacy longer slug so only one URL is live.
  if (pageSlug === DEFAULT_SLUG) {
    pages = pages.filter(function (p) {
      return !(p && p.slug === LEGACY_SLUG);
    });
  }

  const ix = pages.findIndex(function (p) {
    return p && p.slug === pageSlug;
  });
  if (ix >= 0) {
    pages[ix] = Object.assign({}, pages[ix], page, {
      status: 'published',
      pageSections: Object.assign({}, (pages[ix].pageSections || {}), { customHtml: pack }),
      pageApps: page.pageApps,
      pageLayoutOrder: page.pageLayoutOrder
    });
  } else {
    pages.push(page);
  }
  cfg.pages = pages;

  const { error: upErr } = await sb.from('sites').update({ config: cfg }).eq('id', site.id);
  if (upErr) throw upErr;

  // Enable app install for marketplace/editor visibility
  const { data: existingSa } = await sb
    .from('site_apps')
    .select('id')
    .eq('site_id', site.id)
    .eq('app_id', app.id)
    .maybeSingle();

  const saRow = {
    site_id: site.id,
    app_id: app.id,
    enabled: true,
    activation_state: 'active',
    position_slot: 'mid',
    updated_at: new Date().toISOString()
  };
  if (existingSa) {
    const { error } = await sb.from('site_apps').update(saRow).eq('id', existingSa.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from('site_apps').insert(saRow);
    if (error) throw error;
  }

  console.log('OK —', siteSlug + '/' + pageSlug, '(published)');
  console.log('URL path: /' + siteSlug + '/' + pageSlug + ' (or custom domain /' + pageSlug + ')');
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
