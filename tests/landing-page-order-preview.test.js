'use strict';

/** Landing pages: section order follows the page's Position list (server pre-paint CSS), and
 *  the editor preview draws the page's own app layouts (not the homepage's). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'x';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'x';

const root = path.join(__dirname, '..');
const guard = require('../lib/trade-render-guard');
const render = require('../api/render.js');

test('page order: apps in Position order, missing apps appended, no page → null', () => {
  const p = { pageApps: [{ key: 'heroSlider' }, { key: 'services' }, { key: 'ctaBanner' }, { key: 'textBox' }], pageLayoutOrder: ['heroSlider', 'services', 'ctaBanner', '__lpArticle'] };
  assert.deepEqual(render._pageSectionOrder(p), ['heroSlider', 'services', 'ctaBanner', 'textBox']);
  assert.equal(render._pageSectionOrder({ pageApps: [] }), null);
  assert.equal(render._pageSectionOrder(null), null);
});

test('pre-paint order CSS uses the page list when given, the homepage order otherwise', () => {
  const html = '<html><head></head><body></body></html>';
  const pg = guard.injectSectionOrderCss(html, { sectionOrder: ['services', 'ctaBanner'], pageSectionOrder: ['ctaBanner', 'services', '__lpArticle'] });
  assert.match(pg, /\[data-sec="ctaBanner"\]\{order:1!important\}\[data-sec="services"\]\{order:2!important\}/);
  assert.doesNotMatch(pg, /__lpArticle/);
  const home = guard.injectSectionOrderCss(html, { sectionOrder: ['services', 'ctaBanner'] });
  assert.doesNotMatch(home, /\[data-sec="ctaBanner"\]\{order:1!important\}/);
});

test('render passes the page order to the guard; preview draws page layouts', () => {
  const src = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');
  assert.match(src, /const _po = pageSectionOrder\(_pageRow\);/);
  const tpl = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;
  assert.match(tpl, /var C=_lpMergedPageConfig\(p\); C\.__lpPageMerged=true; window\.__lpLiveCfg=C;/);
  const js = fs.readFileSync(path.join(root, 'assets/lp-layouts.js'), 'utf8');
  assert.match(js, /if \(live && live\.__lpPageMerged\) LAST = live;/);
});
