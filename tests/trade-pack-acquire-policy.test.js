'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const policy = require('../lib/trade-pack-acquire-policy');
const acquireSrc = fs.readFileSync(path.join(root, 'api/partner/acquire-trade-pack.js'), 'utf8');
const manageSrc = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const partnerSrc = fs.readFileSync(path.join(root, 'partner.html'), 'utf8');

describe('trade-pack acquire — create does not bind location', () => {
  it('policy: create never records usage; bind sources do', () => {
    assert.equal(policy.shouldRecordPackLocationUsage('create', 'new_trade'), false);
    assert.equal(policy.shouldRecordPackLocationUsage('create'), false);
    assert.equal(policy.shouldRecordPackLocationUsage('pick', 'existing'), true);
    assert.equal(policy.shouldRecordPackLocationUsage('pick', 'first_pack'), true);
    assert.equal(policy.shouldRecordPackLocationUsage('pick', 'generated'), true);
    assert.equal(policy.shouldRecordPackLocationUsage('pick', 'already_bound'), true);
  });

  it('create success path does not call recordPackLocationUsage', () => {
    const createIdx = acquireSrc.indexOf("if (mode === 'create')");
    const nextBlock = acquireSrc.indexOf('if (!variants.length)', createIdx + 1);
    assert.ok(createIdx > 0);
    assert.ok(nextBlock > createIdx);
    const block = acquireSrc.slice(createIdx, nextBlock);
    assert.match(block, /libraryOnly:\s*true/);
    assert.match(block, /do NOT record pack_location_usage/i);
    assert.doesNotMatch(block, /await recordPackLocationUsage/);
    assert.doesNotMatch(block, /await bumpPackUseCount/);
    assert.match(block, /source: 'new_trade'/);
  });

  it('pick / first_pack / regenerate still record usage', () => {
    assert.match(acquireSrc, /source: 'first_pack'/);
    assert.match(acquireSrc, /source: 'existing'/);
    assert.match(acquireSrc, /source: 'generated'/);
    const firstPackIdx = acquireSrc.indexOf("source: 'first_pack'");
    const before = acquireSrc.slice(Math.max(0, firstPackIdx - 450), firstPackIdx);
    assert.match(before, /recordPackLocationUsage/);
  });

  it('preferredVariant supports idempotent already_bound', () => {
    assert.match(acquireSrc, /preferredVariant/);
    assert.match(acquireSrc, /source: 'already_bound'/);
    assert.match(acquireSrc, /alreadyBound:\s*true/);
  });

  it('manage + partner cache created pack and pass preferredVariant on seed', () => {
    assert.match(manageSrc, /lpCacheCreatedTradePack/);
    assert.match(manageSrc, /lpPreferredVariantFor/);
    assert.match(manageSrc, /preferredVariant:lpPreferredVariantFor/);
    assert.doesNotMatch(manageSrc, /\},preferredVariant:/);
    assert.match(partnerSrc, /cacheCreatedTradePack/);
    assert.match(partnerSrc, /preferredVariant:preferredVariantFor/);
  });

  it('libraryOnly create response helper', () => {
    assert.equal(
      policy.isLibraryOnlyCreateResponse({
        ok: true,
        source: 'new_trade',
        libraryOnly: true,
      }),
      true
    );
    assert.equal(
      policy.isLibraryOnlyCreateResponse({
        ok: true,
        source: 'existing',
      }),
      false
    );
  });
});
