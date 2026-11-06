'use strict';

/**
 * Nov 2026: copied sites share the original's Cloudinary files. Deleting an image that the
 * editing site no longer uses wiped it off other live sites (RTT hero, Bean Culture trust bar,
 * Canberra Hot Water projects …). The server now keeps any file still referenced anywhere.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'x';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'x';
process.env.CLOUDINARY_URL = 'cloudinary://key:secret@dzx6x1hou';

const { findReferences } = require('../lib/cloudinary/references');
const del = require('../api/cloudinary/delete');

const HERO = 'leadpages/43e3819a-030b-40d2-b5b7-aae70e86cf61/heroslider/imageurl/mrkn1t3s8m33v';

function fakeAdmin(tables) {
  return {
    from(table) {
      const rows = tables[table] || [];
      const q = { _eq: null };
      q.select = () => q;
      q.eq = (k, v) => { q._eq = [k, v]; return q; };
      q.range = async (a, b) => ({ data: rows.slice(a, b + 1), error: null });
      q.then = (fn) => Promise.resolve({ data: q._eq ? rows.filter((r) => r[q._eq[0]] === q._eq[1]) : rows, error: null }).then(fn);
      return q;
    }
  };
}

function run(body) {
  return new Promise((resolve) => {
    const res = { code: 0, status(c) { this.code = c; return this; }, json(j) { resolve({ code: this.code, body: j }); } };
    del({ method: 'POST', headers: { authorization: 'Bearer t' }, body }, res);
  });
}

let cloudCalls = [];
test.beforeEach(() => {
  cloudCalls = [];
  global.fetch = async (url, opts) => {
    if (String(url).includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'u1' }) };
    cloudCalls.push({ url: String(url), method: opts && opts.method });
    return { ok: true, json: async () => ({ deleted: {} }) };
  };
});

test('findReferences sees a file used by another site, a partner page or a backup', async () => {
  const admin = fakeAdmin({
    sites: [{ id: 'rtt', config: { sections: { heroSlider: { slides: [{ imageUrl: 'https://res.cloudinary.com/x/image/upload/v1/' + HERO + '.png' }] } } } }],
    site_backups: [{ id: 'b1', site_id: 'old', config: { x: HERO } }]
  });
  const r = await findReferences(admin, HERO);
  assert.equal(r.complete, true);
  assert.deepEqual(r.refs.map((x) => x.table).sort(), ['site_backups', 'sites']);
});

test('copy deleting a file the original still shows is refused and nothing is deleted', async () => {
  del._setAdmin(fakeAdmin({ sites: [{ id: 'rtt', config: { hero: 'https://res.cloudinary.com/x/image/upload/v1/' + HERO + '.png' } }, { id: 'copy', config: {} }] }));
  const r = await run({ publicId: HERO });
  assert.equal(r.code, 409);
  assert.equal(r.body.error, 'in_use');
  assert.equal(cloudCalls.filter((c) => c.method === 'DELETE').length, 0);
});

test('a file nothing uses any more is still deleted', async () => {
  del._setAdmin(fakeAdmin({ sites: [{ id: 'rtt', config: { hero: 'something-else' } }] }));
  const r = await run({ publicId: HERO });
  assert.equal(r.code, 200);
  assert.equal(cloudCalls.filter((c) => c.method === 'DELETE').length, 1);
});

test('deleting a whole site folder is skipped while another site uses its files', async () => {
  const folder = 'leadpages/9e4e8cba-f57d-4aa3-99f6-fc22cd9551f8/';
  del._setAdmin(fakeAdmin({ sites: [
    { id: '9e4e8cba-f57d-4aa3-99f6-fc22cd9551f8', slug: 'yass', config: { a: folder + 'hero/1.jpg' } },
    { id: 'hot-water', slug: 'hot-water', config: { a: folder + 'hero/1.jpg' } }
  ] }));
  const r = await run({ prefix: folder });
  assert.equal(r.code, 409);
  assert.equal(r.body.error, 'in_use_elsewhere');
  assert.equal(cloudCalls.length, 0);
});

test('deleting a site folder only it uses goes ahead (its own rows and backups do not count)', async () => {
  const folder = 'leadpages/9e4e8cba-f57d-4aa3-99f6-fc22cd9551f8/';
  del._setAdmin(fakeAdmin({
    sites: [{ id: '9e4e8cba-f57d-4aa3-99f6-fc22cd9551f8', slug: 'yass', config: { a: folder + 'hero/1.jpg' } }],
    site_backups: [{ id: 'b', site_id: '9e4e8cba-f57d-4aa3-99f6-fc22cd9551f8', config: { a: folder + 'x.jpg' } }]
  }));
  const r = await run({ prefix: folder });
  assert.equal(r.code, 200);
  assert.ok(cloudCalls.some((c) => c.method === 'DELETE'));
});

test('if the database cannot be read, nothing is deleted', async () => {
  del._setAdmin({ from() { const q = {}; q.select = () => q; q.eq = () => q; q.range = async () => ({ data: null, error: { message: 'timeout' } }); q.then = (f) => Promise.resolve({ data: [] }).then(f); return q; } });
  const r = await run({ publicId: HERO });
  assert.equal(r.code, 409);
  assert.equal(cloudCalls.filter((c) => c.method === 'DELETE').length, 0);
});
