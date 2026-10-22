'use strict';

/**
 * Customer order page opens as an invoice (editing behind "Make changes", only before lockout);
 * checkout asks first + last name; message money placeholders never print "$$".
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const { renderTemplate } = require('../lib/order/messaging');

test('a "$" typed before a money placeholder is not doubled', () => {
  const vars = { deposit_amount: '$50.00', cart_total: '$12.00', first_name: 'Sarah' };
  assert.equal(renderTemplate('Pay your ${{deposit_amount}} deposit', vars), 'Pay your $50.00 deposit');
  assert.equal(renderTemplate('Pay your {{deposit_amount}} deposit', vars), 'Pay your $50.00 deposit');
  assert.equal(renderTemplate('Cart $ {{ cart_total }}', vars), 'Cart $12.00');
  assert.equal(renderTemplate('Hi {{first_name}}, $5 off', vars), 'Hi Sarah, $5 off');
  assert.equal(renderTemplate('{{x}}', { x: '$$1 $&' }), '$$1 $&'); // values are literal
  assert.doesNotMatch(read('lib/order/presets.js'), /\$\{\{deposit_amount\}\}/);
});

test('order page renders the invoice by default; edit view only via Make changes', () => {
  const html = read('order-portal.html');
  assert.match(html, /function renderInvoice\(data\)/);
  assert.match(html, /if\(!window\.__portalEdit \|\| !data\.can_edit\)\{/);
  // Make changes only when the order can still be edited (server can_edit covers lockout + season lock)
  assert.match(html, /if\(data\.can_edit\)\{\s*html \+= '<div class="inv-change">/);
  assert.match(html, /class="ghost js-edit">Make changes<\/button>/);
  assert.match(html, /class="ghost js-back"[^>]*>← Back to order<\/button>/);
  // invoice shows no edit inputs or save button
  const inv = html.slice(html.indexOf('function renderInvoice(data)'), html.indexOf('  function render(data){'));
  assert.doesNotMatch(inv, /ed-qty|js-save/);
  assert.match(inv, /renderActionButtons\(o, d, false\)/);
  assert.match(read('api/order/portal.js'), /created_at: order\.created_at,/);
});

test('checkout asks for first and last name and sends "First Last"', () => {
  const js = read('assets/lp-order-storefront.js');
  assert.match(js, /id="oe-fname" required autocomplete="given-name"/);
  assert.match(js, /id="oe-lname" required autocomplete="family-name"/);
  assert.match(js, /Please enter your first and last name\./);
  assert.match(js, /var name = firstName \+ ' ' \+ lastName;/);
  const start = js.indexOf('  function splitNameClient(name) {');
  const fnSrc = js.slice(start, js.indexOf('\n  }\n', start) + 4);
  const splitNameClient = new Function(fnSrc + '\nreturn splitNameClient;')();
  assert.deepEqual(splitNameClient('Sarah Brown'), { first: 'Sarah', last: 'Brown' });
  assert.deepEqual(splitNameClient('Mary Anne Smith'), { first: 'Mary Anne', last: 'Smith' });
  assert.deepEqual(splitNameClient('Hilary'), { first: 'Hilary', last: '' });
  assert.deepEqual(splitNameClient(''), { first: '', last: '' });
});

test('docket layout: logo, order box, pickup day/date, surname/first, $/kg table, total payable', () => {
  const html = read('order-portal.html');
  assert.match(html, /<article class="card docket">/);
  assert.match(html, /class="dk-logo" src="'\+esc\(bz\.logo_url\)/);
  assert.match(html, /PICK UP DATE:/);
  assert.match(html, /Surname:<\/span>[\s\S]*First Name:/);
  assert.match(html, /<th class="dk-q">Quantity<\/th><th>Order<\/th><th class="dk-r dk-rate">\$\/kg<\/th>/);
  assert.match(html, /TOTAL PAYABLE<br>INCLUDING GST/);
  assert.match(html, /For and on behalf of /);
  const p = read('api/order/portal.js');
  assert.match(p, /logo_url: \(site && site\.cfg_logo/);
  assert.match(p, /unit_price_cents: it\.unit_price_cents,/);
  assert.match(p, /customer_phone: order\.customer_phone,/);
});

test('quantity-only per-kg items are priced when weighed (no made-up 1 kg)', () => {
  const { buildOrderItemRow } = require('../lib/order/order-item-build');
  const site = { id: 's' };
  const gst = { enabled: false, category_ids: [] };
  const ham = { id: 'h', name: 'HAM - Boned and rolled', pricing_method: 'per_weight', price_per_kg_cents: 4620, options: { size_mode: 'each', minimum_kg: 4 } };
  const r = buildOrderItemRow({ product_id: 'h', quantity: 1 }, ham, site, gst, {}, 0);
  assert.equal(r.requested_weight_kg, null);
  assert.equal(r.unit_price_cents, 4620);
  assert.equal(r.line_known_cents, null);
  assert.equal(r.price_status, 'tbc');
  // pack with no pack weight behaves the same
  const pk = Object.assign({}, ham, { options: { size_mode: 'pack', pack_weight_kg: null } });
  assert.equal(buildOrderItemRow({ product_id: 'h', quantity: 1 }, pk, site, gst, {}, 0).price_status, 'tbc');
  // weighed items keep their default / minimum weight estimate
  const steak = { id: 's', name: 'Steak', pricing_method: 'per_weight', price_per_kg_cents: 5000, options: { size_mode: 'variable', minimum_kg: 1.5 } };
  const s2 = buildOrderItemRow({ product_id: 's', quantity: 1 }, steak, site, gst, {}, 0);
  assert.equal(s2.requested_weight_kg, 1.5);
  assert.equal(s2.line_known_cents, 7500);
  // an explicit weight is still respected
  assert.equal(buildOrderItemRow({ product_id: 'h', quantity: 1, requested_weight_kg: 3.2 }, ham, site, gst, {}, 0).requested_weight_kg, 3.2);
  assert.match(read('lib/order/service.js'), /!isCountOnlySize\(product\)/);
});

test('staff screens split names into First / Last', () => {
  const html = read('orders.html');
  assert.match(html, /function lpSplitName\(el, opts\)/);
  assert.match(html, /lpSplitName\(\$\('no-name'\), \{ required: true \}\)/);
  assert.match(html, /if \(\$\('om-cust-name'\)\) lpSplitName\(\$\('om-cust-name'\)\);/);
  assert.match(html, /if \(\$\('cd-name'\)\) lpSplitName\(\$\('cd-name'\)\);/);
  assert.match(html, /var hasName = lpNameComplete\(\$\('no-name'\)\);/);
  const start = html.indexOf('  function lpSplitNameParts(full){');
  const src = html.slice(start, html.indexOf('\n  }\n', start) + 4);
  const split = new Function(src + '\nreturn lpSplitNameParts;')();
  assert.deepEqual(split('Andrew & Belinda Chamberlain'), { first: 'Andrew & Belinda', last: 'Chamberlain' });
  assert.deepEqual(split('Richard'), { first: 'Richard', last: '' });
});

test('phone sign-in buttons stay visible in portrait (only the desktop bar hides on phones)', () => {
  const html = read('order-portal.html');
  const mobile = html.slice(html.indexOf('@media(max-width:720px){'), html.indexOf('.portal-bar{', html.indexOf('@media(max-width:720px){')));
  assert.doesNotMatch(mobile, /^\s*\.actions\{display:none;\}/m);
  assert.match(mobile, /\.portal-bar-desktop\{display:none!important;\}/);
});
