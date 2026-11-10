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
  // the friendly name is only for the partner; the page keeps the design's business name
  assert.equal(row.site_label, 'Hot Water Canberra');
  assert.equal(row.business_name, 'Duncan');
});

test('AI trade content fills the design with wording only', async () => {
  const design = { id: 't1', name: 'D', partner_id: 'p1', shared_with_partners: false, source_site_id: null,
    config: { name: 'Duncan', theme: { pipe: '#011C3B' }, logo: { imageUrl: 'logo.svg' },
      services: [{ title: 'Aircon', body: '', image: 'a.jpg', icon: 'snowflake' }],
      sections: { heroSlider: { on: true, slides: [{ eyebrow: 'E', heading: 'Old', highlightText: '', subText: 'S', imageUrl: 'h.jpg' }] },
        services: { on: true, heading: 'Our services', intro: 'I' }, reviews: { on: true, items: [{ who: 'Real', text: 'Real review' }] } } } };
  const { handler, inserted } = load({ partners: [{ id: 'p1', user_id: 'u1', status: 'active', can_create_sites: true }], partner_themes: [design] });
  const pack = { tradeType: 'Drain Specialist', theme: { pipe: '#123456' },
    sections: { hero: { eyebrow: 'Drains', title: 'Drains cleared in {location}', titleHl: 'fast', sub: 'Sub' }, services: { heading: 'Every drain sorted', intro: 'Intro' },
      reviews: { items: [{ who: 'Fake', text: 'Fake review' }] } },
    services: [{ title: 'Blocked toilets', body: 'Body', icon: '🚽' }] };
  const r = await call(handler, { label: 'Drains page', themeId: 't1', seedContent: true, starterPack: pack, industry: 'Drain Specialist', targetLocation: 'Belconnen' });
  assert.equal(r.code, 200);
  const c = inserted[0].config;
  assert.equal(c.sections.heroSlider.slides[0].heading, 'Drains cleared in Belconnen');
  assert.equal(c.sections.heroSlider.slides[0].imageUrl, 'h.jpg');
  assert.equal(c.sections.services.heading, 'Every drain sorted');
  assert.deepEqual(c.services[0], { title: 'Blocked toilets', body: '', image: 'a.jpg', icon: 'snowflake', imageAlt: 'Blocked toilets' });
  assert.deepEqual(c.theme, { pipe: '#011C3B' });
  assert.equal(c.logo.imageUrl, 'logo.svg');
  assert.equal(c.sections.reviews.items[0].who, 'Real');
  assert.equal(c.sections.seoTokens.location, 'Belconnen');
  assert.equal(c._createdFrom.aiContent.targetLocation, 'Belconnen');
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

test('partner dashboard: LeadPages-made (locked) designs have no Delete for partners; preview / new website', () => {
  const html = require('fs').readFileSync(path.join(__dirname, '../partner.html'), 'utf8');
  assert.match(html, /var del=\(!t\.locked \|\| state\.asAdmin\)/);
  assert.match(html, /Made by LeadPages/);
  assert.match(html, /t\.partner_id===mine \|\| !!t\.shared_with_partners/);
  assert.match(html, /data-newfrom=/);
  assert.match(html, /\/api\/partner\/new-site/);
  assert.match(html, /id="ys-card"/);
  assert.match(html, /body=\{ label:name, themeId:nsPick \}/);
  assert.match(html, /if\(state\.asAdmin && state\.partner\) payload\.asPartnerId=state\.partner\.id;/);
  const mock = require('fs').readFileSync(path.join(__dirname, '../api/partner/add-mockup.js'), 'utf8');
  assert.match(mock, /if \(!prof \|\| !prof\.is_super_admin\) return res\.status\(403\)/);
  const manage = require('fs').readFileSync(path.join(__dirname, '../manage.html'), 'utf8');
  assert.match(manage, /return \(role === 'super' \|\| role === 'broker'\) \? 'classic' : 'standard';/);
  assert.match(html, /\?preview=1" target="_blank" rel="noopener" style="padding:6px 11px;font-size:13px">Preview</);
});

test('editor: partners with New websites switched on create from their designs, not the admin form', () => {
  const manage = require('fs').readFileSync(path.join(__dirname, '../manage.html'), 'utf8');
  assert.match(manage, /function _lplCanCreateSite\(\)\{ return currentRole==='super' \|\| \(currentRole==='broker' && !!\(window\.__lpPartnerRow&&window\.__lpPartnerRow\.can_create_sites\)\); \}/);
  assert.match(manage, /if\(currentRole==='broker'\)\{\n      if\(_lplCanCreateSite\(\)\) return openPartnerNewSite\(\);/);
  assert.match(manage, /async function openPartnerNewSite\(\)/);
  assert.match(manage, /fetch\('\/api\/partner\/new-site'/);
  // the admin form stays admin-only
  assert.match(manage, /if\(currentRole!=='super'\)\{ toast\('Only platform admins can create new sites here\.'\); return; \}/);
});
