/**
 * Quote Builder — full-width preview above editor + equipment image area colour.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '../..');
const display = fs.readFileSync(path.join(root, 'assets/lp-quote-display.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.css'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');

assert.ok(display.includes('ec.imageBg'), 'equipmentCards.imageBg maps to CSS var');
assert.ok(display.includes('--lp-oq-shot-bg'), 'shot background CSS variable');
assert.ok(display.includes('var(--lp-oq-shot-bg'), 'fp-shot uses shot bg var');
assert.ok(/\.lp-oq-eq-card \.fp-ph\{[^}]*background:transparent/.test(display), 'placeholder does not cover shot bg');

assert.ok(builder.includes('wizard.equipmentCards.imageBg'), 'image area colour picker path');
assert.ok(builder.includes('Image area background'), 'image area colour picker label');
assert.ok(builder.includes('Matches the published section') || builder.includes('Full-width preview'), 'preview copy mentions layout');

assert.ok(!css.includes('grid-template-columns: 1fr minmax(320px, 480px)'), 'no side-by-side preview column');
assert.ok(!/\.oqb-split-wrap\s*\{/.test(css), 'split wrap layout removed');
assert.ok(css.includes('.oqb-preview-full'), 'full preview host styles');
assert.ok(!/\.oqb-preview-host\s*\{\s*position:\s*sticky/.test(css), 'preview is not sticky side panel');

assert.ok(manage.includes('oq-preview-root'), 'preview root in manage');
assert.ok(manage.includes('oqb-preview-full'), 'full preview class on host');
assert.ok(!manage.includes('oqb-split-wrap'), 'no split wrap markup');
assert.ok(
  /oq-preview-root[\s\S]*?oq-builder-root/.test(manage),
  'preview mounts above builder root'
);
assert.ok(manage.includes('lp-quote-builder.css?v=oq-no-scroll-1'), 'cache-busted builder css');
assert.ok(manage.includes('lp-quote-display.js?v=oq-no-scroll-1'), 'cache-busted display js');
assert.ok(manage.includes('lp-quote-builder.js?v=oq-no-scroll-1'), 'cache-busted builder js');
assert.ok(render.includes('lp-quote-display.js?v=oq-no-scroll-1'), 'public render cache-bust');

console.log('quote-preview-fullwidth.test.js: ok');

