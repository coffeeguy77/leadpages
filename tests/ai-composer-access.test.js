'use strict';

/**
 * AI Composer access (lib/ai-composer/access.js): super admin / trusted partner =
 * full mode, active partner = standard, monthly limits for partners.
 * The Supabase helpers are stubbed.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const httpPath = require.resolve('../lib/layout-composer/http');
const state = { user: null, profile: null, partner: null, count: 0, lastQuery: null };
function q(table) {
  const api = { _t: table, _f: {} };
  ['select', 'in', 'gte'].forEach((m) => { api[m] = function () { if (m === 'gte') api._f.gte = arguments[1]; if (m === 'in') api._f.in = arguments[1]; return api; }; });
  api.eq = function (k, v) { api._f[k] = v; return api; };
  api.maybeSingle = async function () {
    if (table === 'profiles') return { data: state.profile, error: null };
    if (table === 'partners') return { data: state.partner, error: null };
    return { data: null, error: null };
  };
  api.then = function (a, b) { state.lastQuery = api._f; return Promise.resolve({ count: state.count, error: null }).then(a, b); };
  return api;
}
require.cache[httpPath] = { id: httpPath, filename: httpPath, loaded: true, exports: {
  admin: { from: q },
  requireUser: async () => state.user
} };
const access = require('../lib/ai-composer/access');

function reset() { state.user = { id: 'u1' }; state.profile = { is_super_admin: false }; state.partner = null; state.count = 0; delete process.env.AI_COMPOSER_PARTNERS; delete process.env.AI_COMPOSER_PARTNER_MONTHLY; }

test.describe('AI Composer access', () => {
  test('super admins get full mode and no limit', async () => {
    reset(); state.profile = { is_super_admin: true };
    const a = await access.requireComposerAccess({});
    assert.equal(a.ok, true); assert.equal(a.role, 'super'); assert.equal(a.full, true);
    assert.deepEqual(await access.checkMonthlyLimit(a), { ok: true, used: 0, limit: null });
  });

  test('active partners get standard mode; trusted partners get full mode', async () => {
    reset(); state.partner = { id: 'p1', status: 'active' };
    let a = await access.requireComposerAccess({});
    assert.equal(a.role, 'partner'); assert.equal(a.full, false); assert.equal(a.actor.partnerId, 'p1');
    const f = await access.requireComposerAccess({}, { full: true });
    assert.equal(f.ok, false); assert.equal(f.code, 403);
    state.partner = { id: 'p1', status: 'active', composer_access: 'trusted' };
    a = await access.requireComposerAccess({}, { full: true });
    assert.equal(a.ok, true); assert.equal(a.full, true);
  });

  test('no access when signed out, not a partner, inactive, switched off, or partners disabled', async () => {
    reset(); state.user = null;
    assert.equal((await access.requireComposerAccess({})).code, 401);
    reset();
    assert.equal((await access.requireComposerAccess({})).code, 403, 'not a partner');
    state.partner = { id: 'p1', status: 'suspended' };
    assert.equal((await access.requireComposerAccess({})).code, 403);
    state.partner = { id: 'p1', status: 'active', composer_access: 'off' };
    assert.equal((await access.requireComposerAccess({})).code, 403);
    state.partner = { id: 'p1', status: 'active' }; process.env.AI_COMPOSER_PARTNERS = '0';
    assert.equal((await access.requireComposerAccess({})).code, 403);
    delete process.env.AI_COMPOSER_PARTNERS;
  });

  test('monthly limits: per-partner override, env, defaults; counted from the 1st of the month', async () => {
    reset(); state.partner = { id: 'p1', status: 'active' };
    let a = await access.requireComposerAccess({});
    assert.equal(access.monthlyLimit(a), access.DEFAULT_PARTNER_MONTHLY);
    process.env.AI_COMPOSER_PARTNER_MONTHLY = '5';
    assert.equal(access.monthlyLimit(a), 5);
    state.partner.composer_monthly_limit = 2;
    a = await access.requireComposerAccess({});
    assert.equal(access.monthlyLimit(a), 2);
    state.count = 1;
    assert.equal((await access.checkMonthlyLimit(a, '2026-10-20T03:00:00Z')).ok, true);
    assert.equal(state.lastQuery.gte, '2026-10-01T00:00:00.000Z');
    assert.equal(state.lastQuery.partner_id, 'p1');
    state.count = 2;
    const over = await access.checkMonthlyLimit(a);
    assert.equal(over.ok, false); assert.equal(over.code, 429);
    state.partner = { id: 'p2', status: 'active', composer_access: 'trusted' };
    delete process.env.AI_COMPOSER_PARTNER_MONTHLY;
    a = await access.requireComposerAccess({});
    assert.equal(access.monthlyLimit(a), access.DEFAULT_TRUSTED_MONTHLY);
  });
});
