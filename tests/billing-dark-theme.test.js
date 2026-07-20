/**
 * Billing modal must use theme tokens — no hardcoded white card surfaces.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');

const cssStart = manage.indexOf('function _billCss');
const cssEnd = manage.indexOf('function openBillingPage');
assert.ok(cssStart > 0 && cssEnd > cssStart, '_billCss present');
const billCssFn = manage.slice(cssStart, cssEnd);

assert.ok(!/background:#fff/.test(billCssFn), '_billCss must not hardcode white backgrounds');
assert.ok(billCssFn.includes('var(--panel'), '_billCss uses --panel for cards');
assert.ok(billCssFn.includes('var(--surface-2') || billCssFn.includes('var(--panel-soft'), '_billCss uses surface tokens for nested cards');
assert.ok(billCssFn.includes('var(--ink-soft'), '_billCss uses --ink-soft for muted text');
assert.ok(billCssFn.includes('var(--input-bg'), '_billCss themes form controls');
assert.ok(billCssFn.includes('#bl-inv-modal'), '_billCss themes invoice modal');

const renderStart = manage.indexOf('function _billRender');
const gateStart = manage.indexOf('function lpBillingGate');
const billHelpers = manage.slice(renderStart, gateStart);

assert.ok(!/background:#fff/.test(billHelpers), 'billing HTML builders must not hardcode white backgrounds');
assert.ok(billHelpers.includes('class="bl-banner"'), 'account banner uses themed .bl-banner class');
assert.ok(billHelpers.includes('class="bl-label"') || billHelpers.includes("class=\"bl-label\""), 'stripe section labels use .bl-label');
assert.ok(!/color:#445/.test(billHelpers), 'billing helpers must not hardcode #445 muted text');
assert.ok(!/color:#889/.test(billHelpers), 'billing helpers must not hardcode #889 faint text');

console.log('billing-dark-theme: ok');
