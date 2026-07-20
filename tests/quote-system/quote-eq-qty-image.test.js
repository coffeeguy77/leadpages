/**
 * Online Quote — compact equipment qty + card colour/image controls.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '../..');
const display = fs.readFileSync(path.join(root, 'assets/lp-quote-display.js'), 'utf8');
const planning = fs.readFileSync(path.join(root, 'assets/lp-quote-planning.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.js'), 'utf8');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const serializers = fs.readFileSync(path.join(root, 'lib/quote-system/serializers.js'), 'utf8');

assert.ok(display.includes('fp-title-row'), 'title row for name + qty');
assert.ok(display.includes('lp-oq-eq-qty-num'), 'big qty number style');
assert.ok(display.includes('lp-oq-eq-qty-btn'), 'qty up/down buttons');
assert.ok(display.includes('--lp-oq-title'), 'name colour var');
assert.ok(display.includes('--lp-oq-desc'), 'description colour var');
assert.ok(display.includes('--lp-oq-qty-color'), 'qty colour var');
assert.ok(display.includes('--lp-oq-qty-stroke'), 'qty stroke var');
assert.ok(display.includes('fp-img-axis-height'), 'height-lock image class');
assert.ok(display.includes('transform:scale('), 'per-product image zoom');

assert.ok(planning.includes('data-product-qty-btn'), 'qty stepper buttons');
assert.ok(planning.includes('data-qty-delta'), 'qty delta attrs');
assert.ok(!planning.includes('<span>Quantity</span>'), 'no full-width Quantity label block');

assert.ok(builder.includes('titleColor'), 'name colour picker');
assert.ok(builder.includes('descColor'), 'description colour picker');
assert.ok(builder.includes('qtyColor'), 'qty colour picker');
assert.ok(builder.includes('qtyStroke'), 'qty stroke picker');
assert.ok(builder.includes('imageAxis'), 'height/width image mode');
assert.ok(builder.includes('Image zoom'), 'per-product zoom slider label');

assert.ok(serializers.includes('imageAxis'), 'public payload includes imageAxis');
assert.ok(manage.includes('lp-quote-display.js?v='), 'cache-busted display script');

console.log('quote-eq-qty-image.test.js: ok');
