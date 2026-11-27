// Saved searches (Production Summary) + label sizes / printers per area.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const PS = require('../lib/order/product-search');
const L = require('../assets/lp-labels.js');

const item = (name, opts, notes) => ({ product_name: name, notes: notes || '', options_snapshot: { selected: (opts || []).map((l) => ({ label: l })) } });

test('several product words match any; must-include words must all match', () => {
  assert.ok(PS.productMatchesItem(item('TURKEY - Whole 4-4.8 kg'), 'turkey, ham', 'partial', ''));
  assert.ok(PS.productMatchesItem(item('HAM - Half 3.5-4'), 'turkey, ham', 'partial', ''));
  assert.ok(!PS.productMatchesItem(item('PORK - Loin'), 'turkey, ham', 'partial', ''));
  assert.ok(PS.productMatchesItem(item('HAM - Half 3.5-4', ['Glazed']), 'ham', 'partial', 'glazed'));
  assert.ok(!PS.productMatchesItem(item('HAM - Half 3.5-4', ['Glazed']), 'ham', 'partial', 'glazed, whole'));
  assert.ok(PS.productMatchesItem(item('HAM - Whole 7', ['Glazed']), 'ham', 'partial', 'glazed, whole'));
  assert.ok(PS.productMatchesItem(item('BEEF - Girello', [], 'make sure its rare'), 'beef', 'partial', 'rare'));
  assert.ok(PS.productMatchesItem(item('Anything'), '*', 'partial', ''));
  // single word: unchanged behaviour
  assert.ok(PS.productMatchesItem(item('TURKEY - Small Roll (Stuffed)', ['Apricot']), 'turkey', 'partial', 'stuffed'));
});

test('exact mode accepts several exact names', () => {
  assert.ok(PS.productMatchesItem(item('HAM - Whole 7'), 'ham - whole 7, ham - whole 8', 'exact', ''));
  assert.ok(!PS.productMatchesItem(item('HAM - Whole 9'), 'ham - whole 7, ham - whole 8', 'exact', ''));
});

test('each area uses its own size, else item stickers (kitchen/search), else the default', () => {
  const s = { labels: { default_size: 'dymo-99012', areas: { item_stickers: { size: 'dymo-11354', printer: 'DYMO LabelWriter 550' }, kitchen: { size: 'dymo-99014' } } } };
  assert.strictEqual(L.sizeFor(s, 'item_stickers').id, 'dymo-11354');
  assert.strictEqual(L.sizeFor(s, 'search_stickers').id, 'dymo-11354');
  assert.strictEqual(L.sizeFor(s, 'kitchen').id, 'dymo-99014');
  assert.strictEqual(L.sizeFor(s, 'order_labels').id, 'dymo-99012');
  assert.strictEqual(L.printerFor(s, 'search_stickers'), 'DYMO LabelWriter 550');
  assert.strictEqual(L.printerFor(s, 'order_labels'), '');
  assert.strictEqual(L.sizeFor({}, 'item_stickers').id, 'a4-2up', 'nothing set: the A4 sheet as before');
  assert.strictEqual(L.configured({}, 'item_stickers'), false);
});

test('custom sizes are offered and used', () => {
  const s = { labels: { custom_sizes: [{ id: 'c-1', name: 'Kitchen small', w_mm: 50, h_mm: 30 }], areas: { kitchen: { size: 'c-1' } } } };
  assert.strictEqual(L.sizeFor(s, 'kitchen').w_mm, 50);
  assert.ok(L.allSizes(s).some((x) => x.id === 'c-1'));
});

test('small labels drop the extra lines; the sticker fits the label', () => {
  const st = { brand: 'Griffith Butchery', title: 'Turkey', product: 'TURKEY - Small Roll', lines: ['2 kg · Apricot', 'Pickup Thu 24 Dec', 'extra'], who: 'Sue', ref: 'ORD-1', foot: 'Keep refrigerated' };
  const tiny = L.fitLines(st, { w_mm: 54, h_mm: 25 });
  assert.strictEqual(tiny.lines.length, 1);
  assert.strictEqual(tiny.brand, '');
  const big = L.fitLines(st, { w_mm: 101, h_mm: 54 });
  assert.strictEqual(big.lines.length, 3);
  assert.match(L.stickerHtml(st, { w_mm: 57, h_mm: 32 }), /width:57mm;height:32mm/);
});

test('DYMO label XML carries the paper name and the image', () => {
  const xml = L.dymoLabelXml({ w_mm: 89, h_mm: 28, dymo_paper: '99010 Standard Address' }, 'QUJD');
  assert.match(xml, /<DieCutLabel Version="8.0" Units="twips">/);
  assert.match(xml, /<PaperName>99010 Standard Address<\/PaperName>/);
  assert.match(xml, /<PaperOrientation>Landscape<\/PaperOrientation>/);
  assert.match(xml, /<Image>QUJD<\/Image>/);
});

test('wired into orders.html', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
  assert.match(html, /id="ss-card"/);
  assert.match(html, /data-ss="save"/);
  assert.match(html, /data-ss="search-stickers"/);
  assert.match(html, /<option value="next_days">/);
  assert.match(html, /id="settings-panel-labels"/);
  assert.match(html, /window\.LpOrderToolsHost = \{/);
  assert.match(html, /function labelSizePrint\(date, format\)/);
  assert.match(html, /<script src="\/assets\/lp-labels\.js\?v=\d+" defer><\/script>/);
  assert.match(html, /<script src="\/assets\/lp-order-tools\.js\?v=\d+" defer><\/script>/);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets/vendor/dymo.connect.framework.js')));
  const nav = require('../assets/lp-order-admin-nav.js');
  assert.strictEqual(nav.routeMeta('settings-labels').settingsSection, 'labels');
});
