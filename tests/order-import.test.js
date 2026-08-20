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
  fullName
} = require('../lib/order/import-parse');
const { normaliseAuPhone } = require('../lib/order/phone');

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
  assert.equal(fullName(mapped), 'Geoff ABSOLOM');
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
  assert.match(html, /font-size:14\.5px/);
  assert.match(html, /nav-count/);
  assert.match(html, /refreshNavCounts/);
  assert.match(html, /Active \(hide archived\)/);
  assert.match(html, /offset:\s*offset/);
  assert.match(html, /batchSize/);
});

test('import API supports batched commit + archived history copy', function () {
  const fs = require('fs');
  const path = require('path');
  const api = fs.readFileSync(path.join(__dirname, '..', 'api/order/import.js'), 'utf8');
  const lib = fs.readFileSync(path.join(__dirname, '..', 'lib/order/import.js'), 'utf8');
  assert.match(api, /finalize_run/);
  assert.match(api, /next_offset/);
  assert.match(lib, /status:\s*'archived'/);
  assert.match(lib, /next_offset/);
  assert.match(lib, /limit/);
});
