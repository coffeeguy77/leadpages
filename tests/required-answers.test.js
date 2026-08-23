'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  missingRequiredQuestions,
  fastAddButtonLabel,
  assertRequiredAnswers
} = require('../lib/order/required-answers');

test('missingRequiredQuestions flags unanswered required sections', function () {
  var qs = [
    { key: 'stuffing', label: 'Stuffings', required: true, field_type: 'radio' },
    { key: 'cooked', label: 'Cooked?', required: false, field_type: 'yes_no' }
  ];
  var missing = missingRequiredQuestions(qs, {});
  assert.equal(missing.length, 1);
  assert.equal(missing[0].key, 'stuffing');
});

test('fastAddButtonLabel returns Choose Options until required answered', function () {
  var qs = [{ key: 'stuffing', label: 'Stuffings', required: true }];
  assert.equal(fastAddButtonLabel(qs, {}), 'Choose Options');
  assert.equal(fastAddButtonLabel(qs, { stuffing: { value: 'Apricot' } }), 'Add');
  assert.equal(fastAddButtonLabel(qs, { stuffing: { value: 'Apricot' } }, { added: true }), 'Added');
});

test('assertRequiredAnswers throws when missing', function () {
  assert.throws(function () {
    assertRequiredAnswers([{ key: 'x', label: 'X', required: true }], {});
  }, function (err) {
    return err.message === 'required_options_missing';
  });
});
