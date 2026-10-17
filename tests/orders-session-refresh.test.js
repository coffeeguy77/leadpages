'use strict';

/**
 * Shop backend (orders.html): requests must use the current, auto-renewed sign-in token —
 * not the one saved at page load — and retry once after renewing on a 401.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'orders.html'), 'utf8');
const start = html.indexOf('// Supabase renews the sign-in token');
const end = html.indexOf('return j || {};', start);
const block = html.slice(start, html.indexOf('}', end + 'return j || {};'.length) + 1);

function harness({ current, refreshed, statuses }) {
  const sent = [];
  let listener = null;
  const sb = {
    auth: {
      onAuthStateChange(fn) { listener = fn; },
      async getSession() { return { data: { session: current } }; },
      async refreshSession() { return { data: { session: refreshed } }; }
    }
  };
  const fetch = async (_p, init) => {
    sent.push(init.headers.Authorization);
    const status = statuses.shift();
    return { status, ok: status < 400, json: async () => (status < 400 ? { ok: 1 } : { error: 'auth' }) };
  };
  const state = { session: { access_token: 'old' } };
  const api = new Function('sb', 'fetch', 'state', block + '\nreturn api;')(sb, fetch, state);
  return { api, fire: (s) => listener && listener('TOKEN_REFRESHED', s), sent, state };
}

test('uses the current renewed token, not the one from page load', async () => {
  const h = harness({ current: { access_token: 'new' }, statuses: [200] });
  await h.api('/api/order/products');
  assert.deepEqual(h.sent, ['Bearer new']);
  assert.equal(h.state.session.access_token, 'new');
});

test('renews and retries once on 401', async () => {
  const h = harness({ current: { access_token: 'stale' }, refreshed: { access_token: 'fresh' }, statuses: [401, 200] });
  const out = await h.api('/api/order/products');
  assert.deepEqual(h.sent, ['Bearer stale', 'Bearer fresh']);
  assert.deepEqual(out, { ok: 1 });
});

test('shows a clear message instead of "auth" when still refused', async () => {
  const h = harness({ current: { access_token: 'stale' }, refreshed: { access_token: 'fresh' }, statuses: [401, 401] });
  await assert.rejects(h.api('/x'), /sign-in has expired/);
});

test('background renewals update the saved session', () => {
  const h = harness({ current: null, statuses: [] });
  h.fire({ access_token: 'renewed' });
  assert.equal(h.state.session.access_token, 'renewed');
});
