/**
 * Travel tab jumps live preview to Travel step; contact textareas are full-width.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '../..');
const builder = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.js'), 'utf8');
const planning = fs.readFileSync(path.join(root, 'assets/lp-quote-planning.js'), 'utf8');
const online = fs.readFileSync(path.join(root, 'assets/lp-online-quote.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.css'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');

assert.ok(builder.includes("['wizard', 'Styling']"), 'Wizard flow tab renamed to Styling');
assert.ok(builder.includes('_previewNeedsTravel'), 'travel preview helper exists');
assert.ok(builder.includes('_ensurePreviewTravelStep'), 'travel preview jump helper');
assert.ok(builder.includes("self.tab === 'travel'"), 'Travel tab switches preview step');
assert.ok(builder.includes('data-oqb-preview-jump="travel"'), 'Show travel step button');
assert.ok(
  /_previewNeedsTravel[\s\S]*?wizard\.travelCards/.test(builder),
  'travelCards live inside _previewNeedsTravel'
);
const eqFn = builder.match(/QuoteBuilder\.prototype\._previewNeedsEquipment = function\(path\) \{[\s\S]*?\n  \};/);
assert.ok(eqFn, '_previewNeedsEquipment function found');
assert.ok(!eqFn[0].includes('travelCards'), 'equipment helper no longer includes travelCards');
assert.ok(!eqFn[0].includes('travel.zones'), 'equipment helper no longer includes travel.zones');

assert.ok(planning.includes('rows="4"'), 'custom textarea is 4 rows');
assert.ok(planning.includes('lp-oq-field-textarea'), 'textarea field class');
assert.ok(online.includes('.lp-oq-field textarea'), 'live styles textarea');
assert.ok(online.includes('background:transparent'), 'textarea has no fill background');
assert.ok(online.includes('width:100%'), 'textarea full width rule present');
assert.ok(css.includes('.oqb-preview-mock .lp-oq-field textarea'), 'preview styles textarea');
assert.ok(css.includes('background: transparent'), 'preview textarea transparent bg');

assert.ok(manage.includes('oq-portal-style-1'), 'manage cache-bust');
assert.ok(render.includes('oq-portal-style-1'), 'render cache-bust');

console.log('quote-travel-preview-notes.test.js: ok');
