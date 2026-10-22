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
