'use strict';

/** Butchery / farm / food / shop icon pack, "My icons", "Add your own" and the wider online search. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');

function loadPack() {
  global.window = {};
  require('../icons.js');
  require('../icons-more.js');
  require('../icons-pack.js');
  return global.window;
}

test('pack: four groups, safe shapes, merged into the full library with tags', () => {
  const w = loadPack();
  const P = w.LP_ICON_PACK;
  assert.deepEqual(Object.keys(P.cats), ['Butchery', 'Farm animals', 'Food & drink', 'Shop & order']);
  assert.ok(Object.keys(P.icons).length >= 400);
  for (const k of ['x-lucide-lab-cow-head', 'x-icon-park-outline-pig', 'x-icon-park-outline-chicken', 'x-icon-park-outline-turkey', 'x-hugeicons-knife-01', 'x-tabler-shopping-cart']) {
    assert.ok(P.icons[k], k);
  }
  for (const [k, b] of Object.entries(P.icons)) {
    assert.match(k, /^x-[a-z0-9-]+$/);
    assert.ok(w.LP_iconBodyOk(b), k);
    assert.equal(w.LP_ICONS_MORE[k], b);
  }
  const tags = w.LP_ICON_TAGS;
  assert.ok(tags['x-lucide-lab-cow-head'].includes('beef'));
  assert.ok(tags['x-icon-park-outline-pig'].includes('pork'));
  assert.ok(tags['x-tabler-shopping-cart'].includes('order'));
});

test('editor loads the pack and shows its groups and My icons', () => {
  assert.match(manage, /<script src="\/icons-pack\.js" defer><\/script>/);
  assert.match(manage, /data-cat="__mine__">My icons</);
  assert.match(manage, /data-cat="__pack:'\+esc\(x\)\+'"/);
  assert.match(manage, /cat\.indexOf\('__pack:'\)===0/);
});

test('add your own icon: SVG to safe 24px shapes saved as my-<name>', () => {
  assert.match(manage, /function lpIconFromSvg\(text\)/);
  assert.match(manage, /id="icon-own-file" accept="\.svg,image\/svg\+xml"/);
  assert.match(manage, /var key='my-'\+base/);
  assert.match(manage, /var OK=\{path:1,circle:1,rect:1,line:1,polyline:1,polygon:1,ellipse:1,g:1\};/);
});

test('online search covers more outline sets and scales other grids', () => {
  assert.match(manage, /'icon-park-outline':'IconPark'/);
  assert.match(manage, /hugeicons:'Hugeicons'/);
  assert.match(manage, /function lpOnlineNameOk\(prefix,nm\)/);
  assert.match(manage, /Other grid sizes \(e\.g\. 48 or 256\) are scaled onto the 24px grid/);
  assert.doesNotMatch(manage, /if\(iw!==24\|\|ih!==24\|\|ic\.left\|\|ic\.top\) return;/);
});
