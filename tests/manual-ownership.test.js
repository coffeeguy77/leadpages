/**
 * Manual ownership (no sale) + referring clear on Assign partner.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api/billing/take-ownership.js'), 'utf8');

assert.ok(manage.includes('id="mo-take"'), 'Settings has Mark as manually owned button');
assert.ok(manage.includes('wireManualOwnershipCard'), 'wireManualOwnershipCard wired');
assert.ok(manage.includes('/api/billing/take-ownership'), 'UI calls take-ownership API');
assert.ok(manage.includes('id="ap-clear-ref"'), 'Assign partner can clear referring');
assert.ok(manage.includes('referring_partner_id=null') || manage.includes("referring_partner_id:null"), 'clear referring patches null');
assert.ok(manage.includes('Still on partner books via'), 'UI explains referring stuck state');

assert.ok(api.includes('manual_ownership_no_sale'), 'API audits manual ownership');
assert.ok(api.includes('is_mockup = false') || api.includes('is_mockup: false'), 'API clears mockup');
assert.ok(api.includes('referring_partner_id = null') || api.includes('referring_partner_id: null'), 'API clears referring');
assert.ok(api.includes('requireSuper'), 'API is super-admin only');
assert.ok(api.includes('sale_price'), 'API clears sale_price');

console.log('manual-ownership: ok');
