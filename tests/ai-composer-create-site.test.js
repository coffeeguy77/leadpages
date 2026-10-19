'use strict';

/**
 * api/ai-composer/create-site: partners always get a partner demo (draft, is_mockup,
 * sale price, plan, partner ids — like Partner → Add mockup); super admins live or draft.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const httpPath = require.resolve('../lib/layout-composer/http');
const accessPath = require.resolve('../lib/ai-composer/access');
const st = { access: null, inserted: null, profile: { default_plan_key: 'growth' } };
function q(table) {
  const api = {};
  ['select', 'eq'].forEach((m) => { api[m] = () => api; });
  api.maybeSingle = async () => (table === 'partner_profiles' ? { data: st.profile, error: null } : { data: null, error: null });
  api.insert = (row) => { st.inserted = row; return api; };
  api.single = async () => ({ data: Object.assign({ id: 'site1' }, st.inserted), error: null });
  return api;
}
require.cache[httpPath] = { id: httpPath, filename: httpPath, loaded: true, exports: {
  admin: { from: q },
  readBody: async (req) => req.body,
  sendJson: (res, code, body) => { res.code = code; res.body = body; }
} };
require.cache[accessPath] = { id: accessPath, filename: accessPath, loaded: true, exports: {
  requireComposerAccess: async () => st.access
} };
const createSite = require('../api/ai-composer/create-site');

const DESIGN = { url: 'https://res.cloudinary.com/dzx6x1hou/image/upload/v1/leadpages/ai-composer/202610/d.png', width: 1440, height: 2000 };
function body(opts) {
  return { plan: { design: DESIGN, businessName: 'Joinery Co', sections: [{ id: 's1', appKey: 'faq', rows: { y0: 0, y1: 500 } }] },
    fills: [{ sectionId: 's1', appKey: 'faq', scalars: {}, lists: { 'sections.faq.items': [{ q: 'Q?', a: 'A.' }] } }], options: opts || {} };
}

test.describe('AI Composer create-site', () => {
  test('a partner gets a demo site behind the buy bar, never live', async () => {
    st.access = { ok: true, role: 'partner', full: false, partner: { id: 'p9' } };
    const res = {};
    await createSite({ method: 'POST', body: body({ draft: false }) }, res);
    assert.equal(res.code, 200, JSON.stringify(res.body));
    const r = st.inserted;
    assert.equal(r.status, 'draft');
    assert.equal(r.is_mockup, true);
    assert.ok(r.sale_price > 0);
    assert.equal(r.plan_key, 'growth');
    assert.equal(r.referring_partner_id, 'p9');
    assert.equal(r.servicing_partner_id, 'p9');
    assert.equal(r.servicing_status, 'partner_serviced');
    assert.match(r.slug, /-demo$/);
    assert.equal(r.config._mockup.source, 'ai-composer');
    assert.equal(res.body.demo, true);
    assert.match(res.body.previewUrl, /\?preview=1$/);
  });

  test('a super admin creates a live site, or a draft when asked', async () => {
    st.access = { ok: true, role: 'super', full: true, partner: null };
    const res = {};
    await createSite({ method: 'POST', body: body() }, res);
    assert.equal(st.inserted.status, 'live');
    assert.ok(!('is_mockup' in st.inserted));
    await createSite({ method: 'POST', body: body({ draft: true }) }, res);
    assert.equal(st.inserted.status, 'draft');
  });

  test('no access → the access error', async () => {
    st.access = { ok: false, code: 403, error: 'nope' };
    const res = {};
    await createSite({ method: 'POST', body: body() }, res);
    assert.equal(res.code, 403);
  });
});
