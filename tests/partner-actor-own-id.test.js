'use strict';

/**
 * Partner dashboard saves send the partner's own id (body.partner_id). That must work for a
 * normal partner; only acting as a DIFFERENT partner needs super-admin (Nov 2026 fix: Culture
 * template choice and every other partner-page setting were failing with "forbidden").
 */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'x';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'x';

const actorMod = require('../lib/partner/resolve-actor');

const PARTNERS = {
  'p-own': { id: 'p-own', display_name: 'Own', status: 'active', user_id: 'u-1' },
  'p-other': { id: 'p-other', display_name: 'Other', status: 'active', user_id: 'u-2' }
};

function fakeAdmin(superAdmin) {
  return function from(table) {
    const q = { filters: {} };
    q.select = function () { return q; };
    q.eq = function (k, v) { q.filters[k] = v; return q; };
    q.maybeSingle = async function () {
      if (table === 'profiles') return { data: { is_super_admin: superAdmin } };
      if (table === 'partners') {
        if (q.filters.id) return { data: PARTNERS[q.filters.id] || null };
        if (q.filters.user_id) return { data: Object.values(PARTNERS).find((p) => p.user_id === q.filters.user_id) || null };
      }
      return { data: null };
    };
    return q;
  };
}

function req(body) { return { headers: { authorization: 'Bearer t' }, query: {}, body }; }

test.beforeEach(() => {
  global.fetch = async () => ({ ok: true, json: async () => ({ id: 'u-1', email: 'own@example.com' }) });
});

test('partner sending its own partner_id is allowed (not acting as admin)', async () => {
  actorMod.admin.from = fakeAdmin(false);
  const r = await actorMod.resolvePartnerActor(req({}), { body: { partner_id: 'p-own' } });
  assert.ok(!r.error, JSON.stringify(r.error));
  assert.equal(r.partner.id, 'p-own');
  assert.equal(r.asAdmin, false);
});

test('partner sending someone else’s partner_id is still forbidden', async () => {
  actorMod.admin.from = fakeAdmin(false);
  const r = await actorMod.resolvePartnerActor(req({}), { body: { partner_id: 'p-other' } });
  assert.equal(r.error && r.error.status, 403);
});

test('super admin can still act as another partner', async () => {
  actorMod.admin.from = fakeAdmin(true);
  const r = await actorMod.resolvePartnerActor(req({}), { body: { partner_id: 'p-other' } });
  assert.ok(!r.error);
  assert.equal(r.partner.id, 'p-other');
  assert.equal(r.asAdmin, true);
});
