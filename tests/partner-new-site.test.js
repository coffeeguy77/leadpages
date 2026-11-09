'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

function load(db) {
  process.env.SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_ANON_KEY = 'a'; process.env.SUPABASE_SERVICE_ROLE_KEY = 's';
  const inserted = [];
  const sbPath = require.resolve('@supabase/supabase-js');
  require.cache[sbPath] = { id: sbPath, filename: sbPath, loaded: true, exports: { createClient: () => ({
    from(table) {
      const f = {}; let row = null;
      const q = {
        select() { return q; }, eq(k, v) { f[k] = v; return q; },
        insert(r) { row = r; inserted.push(r); return q; },
        single() { return Promise.resolve({ data: Object.assign({ id: 'new' }, row), error: null }); },
        maybeSingle() {
          const rows = (db[table] || []).filter((r) => Object.keys(f).every((k) => r[k] === f[k]));
          return Promise.resolve({ data: rows[0] || null, error: null });
        }
      };
      return q;
    }
  }) } };
  const ep = path.join(__dirname, '../api/partner/new-site.js');
  delete require.cache[ep];
  global.fetch = async () => ({ ok: true, json: async () => ({ id: 'u1' }) });
  return { handler: require(ep), inserted };
}
function call(handler, body) {
  return new Promise((resolve) => {
    const res = { code: 0, status(c) { this.code = c; return this; }, json(j) { resolve({ code: this.code, body: j }); } };
    handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body }, res);
  });
}
const theme = { id: 't1', name: 'Design 1', partner_id: 'p1', shared_with_partners: false, source_site_id: 's1', config: { name: 'Duncan', _mockup: { x: 1 }, sections: { hero: { on: true } } } };

test('partner with the switch gets a draft, non-demo site copied from their design', async () => {
  const { handler, inserted } = load({ partners: [{ id: 'p1', user_id: 'u1', status: 'active', can_create_sites: true }], partner_themes: [theme], sites: [{ id: 's1', template: 'trade', vertical: 'trade' }] });
  const r = await call(handler, { businessName: 'Hot Water Canberra', themeId: 't1' });
  assert.equal(r.code, 200);
  const row = inserted[0];
  assert.equal(row.is_mockup, false);
  assert.equal(row.status, 'draft');
  assert.equal(row.slug, 'hot-water-canberra');
  assert.equal(row.servicing_partner_id, 'p1');
  assert.deepEqual(row.config.sections, { hero: { on: true } });
  assert.equal('_mockup' in row.config, false);
  assert.equal(row.config._createdFrom.themeId, 't1');
});

test('partner without the switch is refused', async () => {
  const { handler, inserted } = load({ partners: [{ id: 'p1', user_id: 'u1', status: 'active', can_create_sites: false }], partner_themes: [theme] });
  const r = await call(handler, { businessName: 'X', themeId: 't1' });
  assert.equal(r.code, 403);
  assert.equal(inserted.length, 0);
});

test("another partner's private design is refused", async () => {
  const { handler, inserted } = load({ partners: [{ id: 'p2', user_id: 'u1', status: 'active', can_create_sites: true }], partner_themes: [theme] });
  const r = await call(handler, { businessName: 'X', themeId: 't1' });
  assert.equal(r.code, 404);
  assert.equal(inserted.length, 0);
});

test('partner dashboard has no design delete button and has preview / new website', () => {
  const html = require('fs').readFileSync(path.join(__dirname, '../partner.html'), 'utf8');
  assert.doesNotMatch(html, /data-deltheme/);
  assert.match(html, /data-newfrom=/);
  assert.match(html, /\/api\/partner\/new-site/);
  assert.match(html, /\?preview=1" target="_blank" rel="noopener" style="padding:6px 11px;font-size:13px">Preview</);
});
