const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const planning = fs.readFileSync(path.join(root, 'assets/lp-quote-planning.js'), 'utf8');
const online = fs.readFileSync(path.join(root, 'assets/lp-online-quote.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'assets/lp-quote-builder.js'), 'utf8');
const logic = fs.readFileSync(path.join(root, 'assets/lp-quote-wizard-logic.js'), 'utf8');

test('beverage qty change does not full-rerender (avoids Continue click swallow)', function() {
  assert.match(planning, /do not re-render/i);
  assert.match(planning, /syncBeverageQtyFromDom/);
  assert.match(planning, /Packages→Travel/);
});

test('live wizard navigates by step identity and syncs package qty before Continue', function() {
  assert.match(online, /moveStep/);
  assert.match(online, /syncWizardDom/);
  assert.match(online, /syncBeverageQtyFromDom/);
  assert.match(online, /stepIndexAfterMove/);
  assert.match(online, /mousedown/);
});

test('builder preview uses the same step-identity Continue behaviour', function() {
  assert.match(builder, /stepIndexAfterMove/);
  assert.match(builder, /syncBeverageQtyFromDom/);
  assert.match(logic, /stepIndexAfterMove/);
});
