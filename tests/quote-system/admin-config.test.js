const { test } = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../../api/quote-system/admin/config');

test('shouldProvisionBeanCulture — only explicit provision flag', function() {
  const fn = handler.shouldProvisionBeanCulture;
  assert.equal(fn({ provision: 'bean-culture' }, true), true);
  assert.equal(fn({ enabled: true, config: {} }, true), false);
  assert.equal(fn({ provision: 'bean-culture' }, false), false);
  assert.equal(fn({ enabled: true, provision: 'blank-builder' }, true), false);
});
