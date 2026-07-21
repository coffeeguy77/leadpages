/**
 * Package / catering cards — 2-up grid + editable stroke / box styling.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '../..');
const display = fs.readFileSync(path.join(root, 'assets/lp-quote-display.js'), 'utf8');
const planning = fs.readFileSync(path.join(root, 'assets/lp-quote-planning.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.css'), 'utf8');
const serializers = fs.readFileSync(path.join(root, 'lib/quote-system/serializers.js'), 'utf8');
const normalize = fs.readFileSync(path.join(root, 'lib/quote-system/normalize-quote-config.js'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');

assert.ok(builder.includes('Package card styling'), 'builder has package card section');
assert.ok(builder.includes('wizard.packageCards.strokeColor'), 'card stroke colour picker');
assert.ok(builder.includes('wizard.packageCards.qtyStroke'), 'qty stroke colour picker');
assert.ok(builder.includes('wizard.packageCards.cardBg'), 'card background picker');
assert.ok(builder.includes('_previewNeedsPackages'), 'preview jumps to packages when editing');

assert.ok(planning.includes("equipmentCardVars(shell, 'packageCards')"), 'live applies packageCards vars');
assert.ok(display.includes('--lp-oq-stroke'), 'stroke CSS var used on cards');
assert.ok(display.includes('.lp-oq-choice.lp-oq-bev-card'), 'bev cards override choice border');
assert.ok(
  display.includes('border:var(--lp-oq-stroke-w,1px) solid var(--lp-oq-stroke,'),
  'editable stroke on package boxes'
);

assert.ok(
  css.includes(':not(.lp-oq-fp-grid):not(.lp-oq-bev-grid)'),
  'preview auto-fit excludes beverage grids'
);
assert.ok(
  css.includes('grid-template-columns: repeat(2, minmax(0, 1fr)) !important'),
  'preview forces 2-up for drinks + catering'
);

assert.ok(serializers.includes('packageCards'), 'public shell exposes packageCards');
assert.ok(normalize.includes('packageCards'), 'normalize ensures packageCards');

assert.ok(manage.includes('oq-verify-portal-2'), 'manage cache-bust');
assert.ok(render.includes('oq-verify-portal-2'), 'render cache-bust');

console.log('quote-package-card-style.test.js: ok');
