const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// lib/seo/sitemap.js is ESM — exercise builders via dynamic import.
describe('sitemap index helpers', async () => {
  const mod = await import('../lib/seo/sitemap.js');

  it('builds sitemapindex XML', () => {
    const xml = mod.buildSitemapIndexXml([
      'https://example.com/a/sitemap.xml',
      { loc: 'https://example.com/b/sitemap.xml', lastmod: '2026-01-02' }
    ]);
    assert.match(xml, /<sitemapindex /);
    assert.match(xml, /https:\/\/example\.com\/a\/sitemap\.xml/);
    assert.match(xml, /<lastmod>2026-01-02<\/lastmod>/);
    assert.doesNotMatch(xml, /<urlset/);
  });

  it('plans direct vs sharded indexes', () => {
    assert.deepEqual(mod.sitemapIndexPlan(100, 40000), { mode: 'direct', pages: 1, pageSize: 40000 });
    const sharded = mod.sitemapIndexPlan(85000, 40000);
    assert.equal(sharded.mode, 'sharded');
    assert.equal(sharded.pages, 3);
  });
});
