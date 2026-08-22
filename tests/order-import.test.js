'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseCsv,
  parseAuDate,
  previewImport,
  PRESET_BUTCHER_LINE_ITEMS,
  mapRow,
  cleanOrderNumber,
  parseSizeWeightKg,
  fullName
} = require('../lib/order/import-parse');
const { normaliseAuPhone, phonesMatch } = require('../lib/order/phone');

test('parseCsv handles quoted commas and butcher rows', function () {
  const text =
    'Jenny,WELLS,0432 807 378,22/12/2025,8958,BEEF - Brisket,3.5 kg,1,,\n' +
    'Angela,ADAMS,0406 346 819,22/12/2025,"8,605",BEEF - Scotch Fillet (Roast),2 kg,1,,\n';
  const rows = parseCsv(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[1][4], '8,605');
  assert.equal(cleanOrderNumber(rows[1][4]), '8605');
});

test('butcher preset maps line items', function () {
  const row = ['Geoff', 'ABSOLOM', '0404 817 077', '23/12/2025', '8773', 'HAM - Rolled Half', '2 - 3 kg', '1', '', ''];
  const mapped = mapRow(row, PRESET_BUTCHER_LINE_ITEMS.mapping);
  assert.equal(fullName(mapped), 'Geoff Absolom');
  assert.equal(mapped.phone, '0404 817 077');
  assert.equal(mapped.product_name, 'HAM - Rolled Half');
  assert.equal(parseAuDate(mapped.pickup_date), '2025-12-23');
  assert.equal(normaliseAuPhone(mapped.phone), '+61404817077');
});

test('previewImport reports column count', function () {
  const rows = parseCsv('a,b,c\n1,2,3\n');
  const preview = previewImport({
    kind: 'customers',
    rows: rows,
    has_header: true,
    mapping: { 0: 'name', 1: 'phone', 2: 'ignore' }
  });
  assert.equal(preview.row_count, 1);
  assert.equal(preview.column_count, 3);
  assert.equal(preview.sample[0].mapped.name, '1');
});

test('orders.html uses LeadPages-scale type and nav counts', function () {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /--fs-base/);
  assert.match(html, /nav-count/);
  assert.match(html, /refreshNavCounts/);
  assert.match(html, /Active \(hide archived\)/);
  assert.match(html, /offset:\s*offset/);
  assert.match(html, /batchSize/);
  assert.match(html, /order_history.*\? 12/);
  assert.match(html, /HTTP 504/);
  assert.match(html, /prod-combo/);
  assert.match(html, /no-pickup-select/);
  assert.match(html, /notes-grow/);
  assert.match(html, /kpi \.l,\s*\.kpi \.lbl/);
});

test('import API supports batched commit + archived history copy', function () {
  const fs = require('fs');
  const path = require('path');
  const api = fs.readFileSync(path.join(__dirname, '..', 'api/order/import.js'), 'utf8');
  const lib = fs.readFileSync(path.join(__dirname, '..', 'lib/order/import.js'), 'utf8');
  assert.match(api, /finalize_run/);
  assert.match(api, /next_offset/);
  assert.match(api, /readBody/);
  assert.match(lib, /status:\s*'archived'/);
  assert.match(lib, /next_offset/);
  assert.match(lib, /limit/);
  assert.match(lib, /importBudgetMs/);
  assert.match(lib, /loadImportCaches/);
  assert.match(lib, /groupOrderHistoryRows/);
});

test('groupOrderHistoryRows groups butcher lines by order number only', function () {
  const { groupOrderHistoryRows, PRESET_BUTCHER_LINE_ITEMS } = require('../lib/order/import-parse');
  const { normaliseAuPhone } = require('../lib/order/phone');
  const rows = [
    ['Jenny', 'WELLS', '0432 807 378', '22/12/2025', '8958', 'BEEF - Brisket', '3.5 kg', '1', '', ''],
    ['Jenny', 'WELLS', '0432807378', '22/12/2025', '8958', 'HAM - Half', '2 kg', '1', '', ''],
    ['Angela', 'ADAMS', '0406 346 819', '22/12/2025', '8605', 'BEEF - Scotch', '2 kg', '1', '', '']
  ];
  const grouped = groupOrderHistoryRows(rows, PRESET_BUTCHER_LINE_ITEMS.mapping, false, normaliseAuPhone);
  assert.equal(grouped.keys.length, 2);
  assert.equal(grouped.groups[grouped.keys[0]].lines.length, 2);
  assert.equal(grouped.groups[grouped.keys[1]].lines.length, 1);
  assert.ok(grouped.keys[0].startsWith('ord:'));
});

test('parseSizeWeightKg reads butcher weight notes', function () {
  assert.equal(parseSizeWeightKg('3.5 kg'), 3.5);
  assert.equal(parseSizeWeightKg('800g'), 0.8);
  assert.equal(parseSizeWeightKg('2 - 3 kg'), 2.5);
  assert.equal(parseSizeWeightKg(''), null);
});

test('phonesMatch ignores spaces in AU mobiles', function () {
  assert.equal(phonesMatch('0414 631 463', '0414631463'), true);
  assert.equal(normaliseAuPhone('0414 631 463'), '+61414631463');
  assert.equal(normaliseAuPhone('0414631463'), '+61414631463');
});

test('import skips existing order_number and sets requested_weight_kg', function () {
  const fs = require('fs');
  const path = require('path');
  const lib = fs.readFileSync(path.join(__dirname, '..', 'lib/order/import.js'), 'utf8');
  assert.match(lib, /eq\('order_number',\s*externalNumber\)/);
  assert.match(lib, /parseSizeWeightKg/);
  assert.match(lib, /requested_weight_kg:\s*weightKg/);
  assert.match(lib, /phone_e164/);
});

test('portal re-links orders by normalised phone', function () {
  const fs = require('fs');
  const path = require('path');
  const api = fs.readFileSync(path.join(__dirname, '..', 'api/order/portal-auth.js'), 'utf8');
  assert.match(api, /relinkOrdersForCustomer/);
  assert.match(api, /phonesMatch/);
  assert.match(api, /requested_weight_kg/);
});

test('storeSmsOtp hard-deletes prior OTPs and unique-hashes Verify rows', function () {
  const fs = require('fs');
  const path = require('path');
  const tokens = fs.readFileSync(path.join(__dirname, '..', 'lib/order/tokens.js'), 'utf8');
  assert.match(tokens, /deletePriorSmsOtps/);
  assert.match(tokens, /\.delete\(\)/);
  assert.match(tokens, /meta->>phone_e164/);
  assert.match(tokens, /VERIFY:/);
  assert.doesNotMatch(tokens, /revoked_at: new Date\(\)\.toISOString\(\)\s*\n\s*\.eq\('purpose', 'sms_otp'\)/);
});

test('storefront has SMS auth modal and in-page My orders', function () {
  const fs = require('fs');
  const path = require('path');
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-order-storefront.js'), 'utf8');
  const shop = fs.readFileSync(path.join(__dirname, '..', 'order-shop.html'), 'utf8');
  assert.match(js, /renderAuthModal/);
  assert.match(js, /renderAccountBox/);
  assert.match(js, /renderAccountOrders/);
  assert.match(js, /renderClientNav/);
  assert.match(js, /data-act="open-auth"/);
  assert.match(js, /lp-oe-modal-backdrop/);
  assert.match(js, /lp-oe-client-nav/);
  assert.match(js, /action:\s*'reorder'/);
  assert.match(shop, /lp-order-storefront\.js\?v=oe-14/);
});

test('displayGivenName prefers first name with title case', function () {
  const { displayGivenName, displayFullName } = require('../lib/order/customer-name');
  assert.equal(displayGivenName('Shaun MATTHEWS'), 'Shaun');
  assert.equal(displayGivenName('SHAUN MATTHEWS'), 'Shaun');
  assert.equal(displayGivenName('MATTHEWS Shaun'), 'Shaun');
  assert.equal(displayGivenName('MATTHEWS, Shaun'), 'Shaun');
  assert.equal(displayGivenName('jenny wells'), 'Jenny');
  assert.equal(displayFullName('MATTHEWS Shaun'), 'Shaun Matthews');
  assert.equal(displayFullName('Shaun MATTHEWS'), 'Shaun Matthews');
  assert.equal(displayFullName('SHAUN MATTHEWS'), 'Shaun Matthews');
  assert.equal(displayFullName('MATTHEWS, Shaun'), 'Shaun Matthews');
});

test('storefront layout is 2/3 menu and larger product titles', function () {
  const fs = require('fs');
  const path = require('path');
  const js = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-order-storefront.js'), 'utf8');
  const cron = fs.readFileSync(path.join(__dirname, '..', 'api/cron/order-abandoned.js'), 'utf8');
  const orders = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(js, /grid-template-columns:minmax\(0,2fr\) minmax\(0,1fr\)/);
  assert.match(js, /\.lp-oe-body h3\{[^}]*font-size:32px/);
  assert.match(cron, /reminder_sent/);
  assert.match(cron, /already_reminded/);
  assert.match(orders, /set-abd-enabled/);
  assert.match(orders, /cust-normalize/);
});

test('reorder uses bulk cart lines and returns packed cart', function () {
  const fs = require('fs');
  const path = require('path');
  const cart = fs.readFileSync(path.join(__dirname, '..', 'lib/order/cart.js'), 'utf8');
  const portal = fs.readFileSync(path.join(__dirname, '..', 'api/order/portal-auth.js'), 'utf8');
  const sf = fs.readFileSync(path.join(__dirname, '..', 'assets/lp-order-storefront.js'), 'utf8');
  assert.match(cart, /addReorderLines/);
  assert.match(portal, /addReorderLines/);
  assert.match(portal, /packCartResponse/);
  assert.match(sf, /applyPacked\(re\)/);
  assert.match(sf, /lp-oe-msg\.is-ok/);
});
