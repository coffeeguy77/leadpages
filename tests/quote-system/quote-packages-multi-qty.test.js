/**
 * Packages step — multi-select with per-option quantity.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { resolveBeverageLines } = require('../../lib/quote-system/pricing');

const root = path.join(__dirname, '../..');
const planning = fs.readFileSync(path.join(root, 'assets/lp-quote-planning.js'), 'utf8');
const online = fs.readFileSync(path.join(root, 'assets/lp-online-quote.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.js'), 'utf8');
const display = fs.readFileSync(path.join(root, 'assets/lp-quote-display.js'), 'utf8');
const pricing = fs.readFileSync(path.join(root, 'lib/quote-system/pricing.js'), 'utf8');
const calc = fs.readFileSync(path.join(root, 'lib/quote-system/calculator.js'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');

assert.deepEqual(
  resolveBeverageLines({ beverageId: 'hot', guestCount: 200 }),
  [{ beverageId: 'hot', quantity: 200 }]
);
assert.deepEqual(
  resolveBeverageLines({
    beverageLines: [
      { beverageId: 'hot', quantity: 200 },
      { beverageId: 'iced', quantity: 50 },
      { beverageId: 'x', quantity: 0 }
    ]
  }),
  [
    { beverageId: 'hot', quantity: 200 },
    { beverageId: 'iced', quantity: 50 }
  ]
);

assert.ok(pricing.includes('function resolveBeverageLines'), 'pricing resolves lines');
assert.ok(calc.includes('resolveBeverageLines(inp'), 'calculator loops beverage lines');

assert.ok(planning.includes('renderBeverageQtyCards'), 'planning renders qty cards');
assert.ok(planning.includes('wireBeverageQty'), 'planning wires qty');
assert.ok(planning.includes('data-bev-qty-input'), 'qty input on each card');
assert.ok(planning.includes('beverageLines'), 'progressPayload includes beverageLines');

assert.ok(online.includes('renderBeverageQtyCards'), 'live uses qty cards');
assert.ok(online.includes('wireBeverageQty'), 'live wires qty');
assert.ok(online.includes('beverageLines'), 'live state has beverageLines');
assert.ok(!online.includes('Guest count and beverage package'), 'old guest intro removed');

assert.ok(builder.includes('renderBeverageQtyCards'), 'preview uses qty cards');
assert.ok(builder.includes('Group on Packages step'), 'builder group field');
assert.ok(builder.includes("value=\"catering\""), 'catering group option');

assert.ok(display.includes('lp-oq-bev-grid'), 'bev grid CSS');
assert.ok(
  display.includes('grid-template-columns:repeat(2,minmax(0,1fr))!important'),
  'packages/catering forced 2-up grid'
);
assert.ok(
  display.includes('.lp-oq-layout-split .lp-oq-choices:not(.lp-oq-fp-grid):not(.lp-oq-bev-grid)'),
  'split layout does not force catering into a column stack'
);
assert.ok(
  online.includes('.lp-oq-choices:not(.lp-oq-fp-grid):not(.lp-oq-bev-grid)'),
  'generic auto-fit skips beverage grids'
);
assert.ok(planning.includes('lp-oq-choices lp-oq-bev-grid'), 'each group uses bev-grid');
assert.ok(planning.includes("equipmentCardVars(shell, 'packageCards')"), 'packageCards style vars applied');
assert.ok(manage.includes('oq-verify-portal-1'), 'manage cache-bust');
assert.ok(render.includes('oq-verify-portal-1'), 'render cache-bust');

console.log('quote-packages-multi-qty.test.js: ok');
