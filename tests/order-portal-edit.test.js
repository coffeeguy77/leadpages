'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { formatOptionsForPortal, summariseChangeRow, normalisePortalAnswers } = require('../lib/order/portal-edit');

test('formatOptionsForPortal includes selected options and answers', function () {
  var item = {
    id: 'i1',
    product_snapshot: {
      selected_options: [{ question: 'Stuffing', label: 'Apple & sage' }]
    }
  };
  var answers = [
    { order_item_id: 'i1', question_label: 'Cook for me?', value: 'Yes' }
  ];
  var labels = formatOptionsForPortal(item, answers);
  assert.equal(labels.length, 2);
  assert.match(labels[0], /Apple/);
  assert.match(labels[1], /Cook/);
});

test('formatOptionsForPortal dedupes selected_options and matching answers', function () {
  var item = {
    id: 'i1',
    product_snapshot: {
      selected_options: [
        { key: 'stuffing', question: 'Stuffing', label: 'Apple & sage' },
        { key: 'cooked', question: 'Cook for me?', label: 'Yes' }
      ]
    }
  };
  var answers = [
    { order_item_id: 'i1', question_key: 'stuffing', question_label: 'Stuffing', value: 'Apple & sage' },
    { order_item_id: 'i1', question_key: 'cooked', question_label: 'Cook for me?', value: 'Yes' }
  ];
  var labels = formatOptionsForPortal(item, answers);
  assert.equal(labels.length, 2);
  assert.match(labels.join(' '), /Stuffing/);
  assert.match(labels.join(' '), /Cook/);
});

test('summariseChangeRow describes removals', function () {
  var row = summariseChangeRow({
    created_at: '2026-12-20T10:00:00Z',
    actor_label: 'Jane',
    field_path: 'item.removed',
    previous_value: { product_name: 'Turkey' },
    source: 'customer_portal'
  });
  assert.match(row.detail, /Removed Turkey/);
  assert.equal(row.who, 'Jane');
});

test('normalisePortalAnswers accepts plain values', function () {
  var a = normalisePortalAnswers({ stuffing: 'Apple', cooked: { value: 'Yes', label: 'Cook for me?' } });
  assert.equal(a.stuffing.value, 'Apple');
  assert.equal(a.cooked.value, 'Yes');
});
