'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');

function load() {
  const a = html.indexOf('  function answersForItem(');
  const b = html.indexOf('  function orderItemsEditable(');
  // eslint-disable-next-line no-new-func
  return new Function(html.slice(a, b) + '\nreturn formatItemOptions;')();
}

test('order view shows each option once, on one line', function () {
  const fmt = load();
  const item = {
    id: 'i1',
    options_snapshot: { selected: [{ key: 'seasoned', question: 'seasoned', label: 'porchetta seasoning', value: 'porchetta seasoning' }] }
  };
  const data = { item_answers: [{ order_item_id: 'i1', question_key: 'seasoned', question_label: 'seasoned', value: 'porchetta seasoning' }] };
  assert.equal(fmt(item, data), 'Seasoned: porchetta seasoning');
});

test('a choice named like its question is shown once; answers without a snapshot still show', function () {
  const fmt = load();
  const item = {
    id: 'i2',
    options_snapshot: { selected: [
      { key: 'stuffings', question: 'Stuffings', label: 'Apricot' },
      { key: 'boned_and_rolled', question: 'Boned and Rolled', label: 'Boned and Rolled' }
    ] }
  };
  const data = { item_answers: [
    { order_item_id: 'i2', question_key: 'stuffings', question_label: 'Stuffings', value: 'Apricot' },
    { order_item_id: 'i2', question_key: 'boned_and_rolled', question_label: 'Boned and Rolled', value: 'Boned and Rolled' },
    { order_item_id: 'i2', question_key: 'msg', question_label: 'Message', value: 'Merry Xmas' }
  ] };
  assert.equal(fmt(item, data), 'Stuffings: Apricot · Boned and Rolled · Message: Merry Xmas');
});
