'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const S = require('../lib/seo-saver');

const ROOT = path.join(__dirname, '..');
const PAGES = [
  { slug: 'excavation', title: 'Excavation Canberra' },
  { slug: 'concrete-driveways', title: 'Concrete Driveways Canberra' },
  { slug: 'residential-concrete', title: 'Residential Concrete Canberra' },
  { slug: 'gallery', title: 'Concreting Gallery' },
  { slug: 'services', title: 'Concreting Services Canberra' },
  { slug: 'about', title: 'About Down Right Concreting' },
  { slug: 'contact-us', title: 'Contact Us' },
];
const live = new Set(['/', ...PAGES.map((p) => '/' + p.slug)]);
function ctx(cfg, reqPath, query, base) {
  return { cfg, reqPath, query: query || {}, base: base || '', pages: PAGES, isLivePath: (p) => live.has(p), omitQuery: { slug: 1, page: 1, lppath: 1 } };
}
const CFG = {
  seoSaver: {
    on: true,
    redirects: [
      { from: '/about-down-right-concrete', to: '/about' },
      { from: '/services/concrete-driveways-canberra', to: '/concrete-driveways' },
      { from: 'https://www.downrightconcreting.com.au/services/excavation', to: '/excavation' },
      { from: '/images/logo_01.png', to: '/assets/sites/drc/logo.png' },
      { from: '/images/igallery/resized/1-100/img_0374-51-*', to: '/assets/sites/drc/gallery/decorative/01.jpg' },
      { from: '/old-blog/*', to: '/news/*' },
      { from: '/index.php?Itemid=105', to: '/contact-us' },
      { from: '/retired', code: 410 },
      { from: '/disabled', to: '/about', on: false },
    ],
  },
};

test('normalisePath handles case, slashes, Joomla index.php and decoding', () => {
  assert.equal(S.normalizePath('/Services//Excavation/'), '/services/excavation');
  assert.equal(S.normalizePath('/index.php/about-us'), '/about-us');
  assert.equal(S.normalizePath('/index.php'), '/');
  assert.equal(S.normalizePath('/caf%C3%A9?x=1#top'), '/café');
  assert.equal(S.normalizePath(''), '/');
});

test('exact rules match regardless of case, trailing slash, .html or a pasted full URL', () => {
  for (const p of ['/About-Down-Right-Concrete', '/about-down-right-concrete/', '/about-down-right-concrete.html', '/index.php/about-down-right-concrete']) {
    const d = S.resolve(ctx(CFG, p));
    assert.equal(d.action, 'redirect', p);
    assert.equal(d.location, '/about', p);
    assert.equal(d.code, 301);
    assert.equal(d.kind, 'redirect');
  }
  assert.equal(S.resolve(ctx(CFG, '/services/excavation')).location, '/excavation');
});

test('prefix rules: image variants and kept path remainders', () => {
  const img = S.resolve(ctx(CFG, '/images/igallery/resized/1-100/IMG_0374-51-800-600-80.jpg'));
  assert.equal(img.location, '/assets/sites/drc/gallery/decorative/01.jpg');
  const thumb = S.resolve(ctx(CFG, '/images/igallery/resized/1-100/IMG_0374-51-120-90-80-c.jpg'));
  assert.equal(thumb.location, '/assets/sites/drc/gallery/decorative/01.jpg');
  assert.equal(S.resolve(ctx(CFG, '/old-blog/2019/my-post')).location, '/news/2019/my-post');
  assert.equal(S.resolve(ctx(CFG, '/old-blog')).location, '/news/');
});

test('query rules need their params; other params do not block a path rule', () => {
  assert.equal(S.resolve(ctx(CFG, '/index.php', { option: 'com_content', Itemid: '105' })).location, '/contact-us');
  // index.php without the Itemid is just the old homepage
  const home = S.resolve(ctx(CFG, '/index.php', { option: 'com_content' }));
  assert.equal(home.location, '/');
  assert.equal(S.resolve(ctx(CFG, '/about-down-right-concrete', { ref: 'x' })).location, '/about');
});

test('410 rules, disabled rules and SEO Saver switched off', () => {
  assert.equal(S.resolve(ctx(CFG, '/retired')).action, 'gone');
  assert.equal(S.resolve(ctx(CFG, '/disabled')).kind, 'fallback', 'a switched-off rule is ignored');
  assert.equal(S.resolve(ctx({ seoSaver: { on: false, redirects: CFG.seoSaver.redirects } }, '/about-down-right-concrete')), null);
  assert.equal(S.resolve(ctx({}, '/anything')), null);
});

test('same page, different spelling → the clean URL', () => {
  assert.equal(S.resolve(ctx(CFG, '/Excavation')).location, '/excavation');
  assert.equal(S.resolve(ctx(CFG, '/gallery/')).location, '/gallery');
  assert.equal(S.resolve(ctx(CFG, '/contact-us.html')).location, '/contact-us');
});

test('smart fallback picks the closest page, then a parent page, then home', () => {
  const S2 = { seoSaver: { on: true, redirects: [] } };
  assert.equal(S.resolve(ctx(S2, '/services/concrete-driveways-canberra')).location, '/concrete-driveways');
  assert.equal(S.resolve(ctx(S2, '/services/residential')).location, '/residential-concrete');
  assert.equal(S.resolve(ctx(S2, '/gallery/old-album-name')).location, '/gallery');
  assert.equal(S.resolve(ctx(S2, '/component/content/article/12-driveway-tips')).location, '/concrete-driveways', 'CMS noise words are ignored');
  assert.equal(S.resolve(ctx(S2, '/index.php/en-gb/about-us')).location, '/about');
  assert.equal(S.resolve(ctx(S2, '/wp-login.php')).location, '/');
  const d = S.resolve(ctx(S2, '/something-unrelated'));
  assert.equal(d.kind, 'fallback');
  assert.equal(d.location, '/');
});

test('fallback modes: home and page (real 404); files never fall back to a page', () => {
  assert.equal(S.resolve(ctx({ seoSaver: { notFound: 'home' } }, '/services/residential')).location, '/');
  assert.equal(S.resolve(ctx({ seoSaver: { notFound: 'page' } }, '/services/residential')).action, 'notFound');
  const img = S.resolve(ctx({ seoSaver: {} }, '/images/unknown.jpg'));
  assert.equal(img.action, 'notFound');
  assert.equal(img.kind, 'not_found');
});

test('LeadPages address keeps the site prefix; platform files and full URLs do not', () => {
  assert.equal(S.resolve(ctx(CFG, '/about-down-right-concrete', {}, '/downrightconcreting')).location, '/downrightconcreting/about');
  assert.equal(S.resolve(ctx(CFG, '/images/logo_01.png', {}, '/downrightconcreting')).location, '/assets/sites/drc/logo.png');
  assert.equal(S.locationFor('https://example.com/x', '/s'), 'https://example.com/x');
  assert.equal(S.locationFor('/', '/s'), '/s');
  assert.equal(S.locationFor('/', ''), '/');
  assert.equal(S.locationFor('/gallery#/gallery/polished', ''), '/gallery#/gallery/polished');
});

test('marketing params carry over; internal and other params do not', () => {
  const d = S.resolve(ctx(CFG, '/about-down-right-concrete', { utm_source: 'google', gclid: 'abc', slug: 'x', foo: 'bar' }));
  assert.equal(d.location, '/about?utm_source=google&gclid=abc');
  const h = S.resolve(ctx(CFG, '/about-down-right-concrete', { utm_medium: 'cpc' }));
  assert.equal(S.locationFor('/gallery#x', '', 'utm_medium=cpc'), '/gallery?utm_medium=cpc#x');
  assert.ok(h.location.endsWith('utm_medium=cpc'));
});

test('logged path is normalised and includes the query only when there is one', () => {
  assert.equal(S.resolve(ctx(CFG, '/About-Down-Right-Concrete/')).path, '/about-down-right-concrete');
  assert.equal(S.resolve(ctx(CFG, '/index.php', { Itemid: '105', option: 'com_content' })).path, '/?itemid=105&option=com_content');
  assert.equal(S.resolve(ctx(CFG, '/about-down-right-concrete', { utm_source: 'fb', gclid: 'x' })).path, '/about-down-right-concrete');
});

test('Googlebot detection', () => {
  assert.ok(S.isGoogle('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'));
  assert.ok(!S.isGoogle('Mozilla/5.0 (Macintosh) Safari/605.1.15'));
});

test('routing: catch-all rewrite only for client domains, after every other rule; robots.txt is dynamic', () => {
  const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const last = v.rewrites[v.rewrites.length - 1];
  assert.equal(last.destination, '/api/render?lpPath=/$1');
  assert.match(last.source, /\(\?!api\//);
  assert.ok(new RegExp(last.missing[0].value).test('www.leadpages.com.au'));
  assert.ok(new RegExp(last.missing[0].value).test('studio.leadpages.com.au'));
  assert.ok(!new RegExp(last.missing[0].value).test('www.downrightconcreting.com.au'));
  assert.ok(!fs.existsSync(path.join(ROOT, 'robots.txt')), 'a static robots.txt would hide the tenant robots.txt on client domains');
  assert.ok(v.rewrites.some((r) => r.source === '/robots.txt' && r.destination === '/api/robots.txt'));
});

test('migration SQL defines the table, logger and locks it to the service role', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'db/seo_saver.sql'), 'utf8');
  assert.match(sql, /create table if not exists public\.site_url_hits/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /create or replace function public\.seo_saver_log/);
  assert.match(sql, /revoke all on function public\.seo_saver_log[^;]+from public, anon, authenticated/);
});
