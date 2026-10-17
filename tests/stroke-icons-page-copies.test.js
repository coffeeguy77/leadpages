'use strict';

/** Landing-page copies keep emptied fields empty; no plumbing starters on other sites;
 *  stroke icons only (emoji → stroke), full icon library, saved site icons; preview loop fix. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('a full page copy (homeCopied) keeps emptied text and lists empty', () => {
  const h = JSON.parse(read('trade.template.json')).html;
  assert.match(h, /_lpDeepMergeSec\(home,page,a\.homeCopied===true\)/);
  assert.match(h, /if\(page\._own===true\|\|arguments\[2\]===true\)\{/);
  const src = h.slice(h.indexOf('function _lpDeepMergeSec'), h.indexOf('function _lpMergedPageConfig'));
  const merge = new Function(src + '\nreturn _lpDeepMergeSec;')();
  const home = { heading: 'How we got here', eyebrow: 'Our story', items: [{ t: 1 }] };
  const page = { heading: '', eyebrow: '', items: [] };
  assert.equal(merge(home, page).heading, 'How we got here', 'old partial copies still fall back');
  const own = merge(home, page, true);
  assert.equal(own.heading, ''); assert.equal(own.eyebrow, ''); assert.deepEqual(own.items, []);
  // Editor: older partial copies are filled in once so later deletions stick.
  const m = read('manage.html');
  assert.match(m, /function lpLegacyMergeSec\(home, page\)/);
  assert.match(m, /p\.pageSections\[k\]=lpLegacyMergeSec\(\(data\.sections\|\|\{\}\)\[k\]\|\|\{\}, ps0\); a\.homeCopied=true;/);
});

test('services feature: an emptied point list stays empty; plumbing starters only on plumbing sites', () => {
  const js = read('assets/lp-layouts.js');
  assert.match(js, /var hasOwn = Array\.isArray\(SV\.featureItems\);/);
  assert.match(js, /function siteServices\(C\)/);
  assert.doesNotMatch(js, /live\(C\.services\)/);
  const m = read('manage.html');
  assert.match(m, /if\(!c\.services\.length&&lpIsPlumbingSite\(c\)\)\{ c\.services=JSON\.parse\(JSON\.stringify\(DEFAULT_TRADE_SVCS\)\); \}/);
  assert.match(m, /d\.services=d\.services\.filter\(function\(x\)\{ return !lpIsStarterService\(x\); \}\)/);
  const h = JSON.parse(read('trade.template.json')).html;
  assert.match(h, /var __plumb=\/plumb\|drain\|gas\\s\*fit\/i\.test/);
});

test('stroke icons only: every emoji maps to an existing icon; no emoji icons in the editor data', () => {
  const box = { window: {} };
  vm.runInNewContext(read('icons.js'), box);
  const I = box.window.LP_ICONS, E = box.window.LP_EMOJI_ICONS;
  assert.ok(E && Object.keys(E).length >= 190);
  for (const e of Object.keys(E)) { assert.ok(I[E[e]], e + ' → ' + E[e]); assert.ok(I[e], 'alias ' + e); }
  assert.ok(I.search && I.circle && I.archive, 'basics added');
  assert.ok(!box.window.LP_searchIcons('').some((k) => !/^[a-z0-9-]+$/.test(k)), 'emoji keys never listed');
  assert.equal(box.window.LP_iconBodyOk('<path d="M1 1"/>'), true);
  assert.equal(box.window.LP_iconBodyOk('<script>alert(1)</script>'), false);
  assert.equal(box.window.LP_iconBodyOk('<path onclick="x" d="M1"/>'), false);
  box.window.LP_registerIcons({ 'x-a': '<path d="M1 1"/>', 'x-b': '<image href="x"/>' });
  assert.ok(I['x-a'] && !I['x-b']);
  const m = read('manage.html');
  const packs = m.slice(m.indexOf('const TRADE_PACKS='), m.indexOf('\n', m.indexOf('const TRADE_PACKS=')));
  assert.ok(!(packs.match(/"icon":"([^"]*)"/g) || []).some((x) => /[←-⯿]|[\ud83c-\udbff]/.test(x)), 'trade packs use icon names');
  assert.match(read('assets/lp-layouts.js'), /function strokeIcons\(\)/);
});

test('full Lucide library in the editor, saved site icons, online search', () => {
  const box = { window: {} };
  vm.runInNewContext(read('icons-more.js'), box);
  assert.ok(Object.keys(box.window.LP_ICONS_MORE).length > 800);
  assert.ok(Object.keys(box.window.LP_ICON_TAGS).length > 1500);
  const m = read('manage.html');
  assert.match(m, /<script src="\/icons-more\.js" defer><\/script>/);
  assert.match(m, /function lpIconRemember\(n\)/);
  assert.match(m, /api\.iconify\.design\/search\?query=/);
  assert.match(m, /var LP_ONLINE_SETS=\{tabler:'Tabler',[^}]*iconoir:'Iconoir',mynaui:'Myna UI'[^}]*\};/);
  assert.match(m, /'lucide-lab':'Lucide Lab'/);
  const h = JSON.parse(read('trade.template.json')).html;
  assert.match(h, /window\.LP_registerIcons\(C\.iconLib\)/);
  assert.ok(fs.existsSync(path.join(root, 'scripts/build-icon-library.js')));
});

test('timeline space above / below', () => {
  assert.match(read('manage.html'), /\{t:'sel',k:'spaceTop',label:'Space above'/);
  assert.match(read('assets/lp-layouts.css'), /\.stl-spt-none \.stl-wrap\{padding-top:0\}/);
});

test('landing app editor: the page reload never calls the temporary previewApply (no loop)', () => {
  const m = read('manage.html');
  assert.match(m, /var _lpPreviewApplyReal = previewApply;/);
  const r = m.slice(m.indexOf('function lpPagePreviewReload(){'), m.indexOf('function lpPreviewSyncPageOrder(){'));
  assert.doesNotMatch(r, /[^_a-zA-Z]previewApply\(/);
});
