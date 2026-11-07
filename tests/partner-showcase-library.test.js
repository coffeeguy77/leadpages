'use strict';

/**
 * Partner showcase library (Nov 2026): LeadPages sites the platform owner ticks in /manage,
 * shown on partner pages in "all", "random", "selected" (with auto-add) or "off" mode.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const lib = require('../lib/partner-website/showcase-library');
const { buildPartnerLandingHtml } = require('../lib/partner-templates');
const { validateWebsiteProfile, mergeWebsiteProfilePatch } = require('../lib/partner-website/validate');
const { buildLocalWebsiteCoWebsiteProfile } = require('../lib/partner-website/local-website-co-profile');

const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function(n) {
  return { id: ('0000000' + n).slice(-8) + '-0000-4000-8000-000000000000', slug: 'site-' + n, business_name: 'Site ' + n, trade: 'Trade ' + n, theme: { hivis: '#123456' }, logo: {} };
});
const CARDS = ROWS.map(function(r) { return lib.libraryCard(r, 'leadpages.com.au'); });

test('config is cleaned: defaults random 3 with auto-add, count 1–9, valid ids only', () => {
  assert.deepEqual(lib.cleanLibraryConfig({}), { mode: 'random', count: 3, autoAdd: true, selected: [], seen: [], title: '', sub: '', mix: 'theirs-first', starred: [], scroll: 'site' });
  const c = lib.cleanLibraryConfig({ mode: 'nope', count: 40, autoAdd: false, selected: ['x', CARDS[0].id, CARDS[0].id] });
  assert.equal(c.mode, 'random');
  assert.equal(c.count, 9);
  assert.equal(c.autoAdd, false);
  assert.deepEqual(c.selected, [CARDS[0].id]);
});

test('modes: all caps at 9, random takes count, off shows none', () => {
  assert.equal(lib.pickLibrary({ mode: 'all' }, CARDS).length, 9);
  assert.equal(lib.pickLibrary({ mode: 'random', count: 4 }, CARDS).length, 4);
  assert.equal(lib.pickLibrary({ mode: 'off' }, CARDS).length, 0);
  // random really mixes: a fixed "random" picks from the end
  const r = lib.pickLibrary({ mode: 'random', count: 2 }, CARDS, { random: function() { return 0.999; } });
  assert.equal(r.length, 2);
});

test('selected: ticked sites, plus new ones only when auto-add is on', () => {
  const seen = CARDS.slice(0, 5).map(function(c) { return c.id; });
  const picked = [CARDS[1].id, CARDS[3].id];
  const on = lib.pickLibrary({ mode: 'selected', selected: picked, seen: seen, autoAdd: true }, CARDS);
  assert.deepEqual(on.slice(0, 2).map(function(c) { return c.id; }), picked);
  assert.ok(on.some(function(c) { return c.id === CARDS[6].id; }), 'unseen site auto-added');
  assert.ok(!on.some(function(c) { return c.id === CARDS[0].id; }), 'seen but unticked stays off');
  const off = lib.pickLibrary({ mode: 'selected', selected: picked, seen: seen, autoAdd: false }, CARDS);
  assert.deepEqual(off.map(function(c) { return c.id; }), picked);
});

test('partner’s own sites are never repeated and limit leaves room for them', () => {
  const out = lib.pickLibrary({ mode: 'all' }, CARDS, { excludeIds: [CARDS[0].id], limit: 3 });
  assert.equal(out.length, 3);
  assert.ok(!out.some(function(c) { return c.id === CARDS[0].id; }));
});

test('library card links to the live site and previews with lp_embed', () => {
  const c = lib.libraryCard({ id: CARDS[0].id, slug: 'pam-connor', business_name: 'Pam', custom_domain: 'pamconnor.com.au', trade: 'Psychology', theme: { hivis: '#1565D8' }, logo: { mode: 'image', imageUrl: 'https://x.test/logo.svg' } }, 'leadpages.com.au');
  assert.equal(c.url, 'https://pamconnor.com.au/');
  assert.equal(c.frameUrl, 'https://leadpages.com.au/pam-connor?lp_embed=1');
  assert.equal(c.host, 'pamconnor.com.au');
  assert.equal(c.logo, 'https://x.test/logo.svg');
  assert.equal(c.color, '#1565D8');
});

test('fetchLibraryCards only returns live sites without a preview password', async () => {
  const fake = {
    from(table) {
      const q = {
        select() { return q; }, order() { return q; }, limit() { return q; },
        in() { return Promise.resolve({ data: [
          { id: 'a', slug: 'a', business_name: 'A', status: 'live' },
          { id: 'b', slug: 'b', business_name: 'B', status: 'draft' },
          { id: 'c', slug: 'c', business_name: 'C', status: 'live', preview_password: 'x' }
        ] }); },
        then(res) { return Promise.resolve({ data: [{ site_id: 'a' }, { site_id: 'b' }, { site_id: 'c' }] }).then(res); }
      };
      return table === 'partner_showcase_library' ? q : q;
    }
  };
  const r = await lib.fetchLibraryCards(fake, 'leadpages.com.au');
  assert.equal(r.ready, true);
  assert.deepEqual(r.cards.map(function(c) { return c.slug; }), ['a']);
});

test('fetchLibraryCards copes with the table not existing yet', async () => {
  const fake = { from() { const q = { select() { return q; }, order() { return q; }, limit() { return Promise.resolve({ error: { message: 'relation "partner_showcase_library" does not exist' } }); } }; return q; } };
  const r = await lib.fetchLibraryCards(fake, 'leadpages.com.au');
  assert.deepEqual(r, { cards: [], ready: false });
});

test('showcaseLibrary is kept and merged in the website profile', () => {
  const v = validateWebsiteProfile({ showcaseLibrary: { mode: 'selected', selected: [CARDS[2].id] } });
  assert.equal(v.showcaseLibrary.mode, 'selected');
  const m = mergeWebsiteProfilePatch(v, { showcaseLibrary: { autoAdd: false } });
  assert.equal(m.showcaseLibrary.mode, 'selected');
  assert.equal(m.showcaseLibrary.autoAdd, false);
  assert.deepEqual(m.showcaseLibrary.selected, [CARDS[2].id]);
});

function page(templateKey, showcaseLibrary, demos) {
  const wp = validateWebsiteProfile(Object.assign(buildLocalWebsiteCoWebsiteProfile(), { showcaseLibrary: showcaseLibrary }));
  const prof = { partner_id: 'p1', showcase_slug: 'x', support_email: 'a@b.c', showcase_config: { templateKey: templateKey, websiteProfile: wp } };
  return buildPartnerLandingHtml(prof, { id: 'p1', display_name: 'Pat Partner' }, demos || [], 'leadpages.com.au', { library: CARDS });
}

test('every design shows the gallery; max 9 cards; featured 3 then "See more"', () => {
  ['webculture', 'localwebsiteco', 'studioplus', 'presence'].forEach(function(k) {
    const html = page(k, { mode: 'all' });
    assert.match(html, /id="built-on-leadpages"/, k);
    assert.equal((html.match(/data-lpsl-card/g) || []).length, 9, k);
    assert.match(html, /See more sites \(6\)/, k);
    assert.match(html, /showcase-library\.css/, k);
    assert.match(html, /lp_embed=1/, k);
  });
});

test('mode off removes the gallery when there are no own sites', () => {
  const html = page('presence', { mode: 'off' });
  assert.doesNotMatch(html, /id="built-on-leadpages"/);
});

test('Studio designs put the partner’s own sites first in the gallery', () => {
  const own = [{ id: 'ffffffff-0000-4000-8000-000000000000', slug: 'my-client', business_name: 'My Client', config: { trade: 'Builder', showcase: { image: 'https://x.test/a.jpg' } } }];
  const html = page('localwebsiteco', { mode: 'random', count: 2 }, own);
  const first = html.indexOf('data-lpsl-card');
  assert.ok(first > 0);
  assert.ok(html.indexOf('My Client', first) > 0 && html.indexOf('My Client', first) < html.indexOf('data-lpsl-card', first + 20));
  assert.equal((html.match(/data-lpsl-card/g) || []).length, 3);
  assert.doesNotMatch(html, /class="st-demos /, 'old live-sites strip replaced by the gallery');
});

test('custom heading from the Showcase tab is used', () => {
  const html = page('studioplus', { mode: 'all', title: 'Sites we love' });
  assert.match(html, /Sites we love/);
});

test('stars: favourites lead in all mode and are the only rotation in random mode', () => {
  const fav = [CARDS[5].id, CARDS[2].id];
  const all = lib.pickLibrary({ mode: 'all', starred: fav }, CARDS);
  assert.deepEqual(all.slice(0, 2).map(function(c) { return c.id; }), fav);
  for (let i = 0; i < 5; i++) {
    const r = lib.pickLibrary({ mode: 'random', count: 3, starred: fav }, CARDS);
    assert.equal(r.length, 2);
    r.forEach(function(c) { assert.ok(fav.indexOf(c.id) >= 0); });
  }
});

test('mix: ours-first, only theirs, only ours (Studio designs)', () => {
  const own = [{ id: 'ffffffff-0000-4000-8000-000000000000', slug: 'my-client', business_name: 'My Client', config: { trade: 'Builder' } }];
  const oursFirst = page('localwebsiteco', { mode: 'all', mix: 'ours-first' }, own);
  const firstCard = oursFirst.slice(oursFirst.indexOf('data-lpsl-card'));
  assert.ok(firstCard.indexOf('Site 1') < firstCard.indexOf('My Client'));
  const theirs = page('localwebsiteco', { mode: 'all', mix: 'theirs' }, own);
  assert.equal((theirs.match(/data-lpsl-card/g) || []).length, 1);
  const ours = page('localwebsiteco', { mode: 'all', mix: 'ours' }, own);
  assert.doesNotMatch(ours, /My Client/);
  assert.doesNotMatch(ours, /class="st-demos /, 'old strip stays hidden');
});

test('pictures and auto-scroll: picture replaces the live preview unless it scrolls', () => {
  const withPic = lib.libraryCard({ id: CARDS[0].id, slug: 'a', business_name: 'A', image_url: 'https://x.test/a.webp' }, 'leadpages.com.au');
  const scroll = lib.libraryCard({ id: CARDS[1].id, slug: 'b', business_name: 'B', image_url: 'https://x.test/b.webp', auto_scroll: true }, 'leadpages.com.au');
  const { librarySection } = require('../lib/partner-templates/showcase-library-section');
  const html = librarySection({ library: { cards: [withPic, scroll] } }, 'studio');
  assert.match(html, /<img class="lpsl-shot" src="https:\/\/x\.test\/a\.webp"/);
  assert.match(html, /lpsl-card--scroll/);
  assert.match(html, /b\?lp_embed=1&amp;lp_scroll=1/);
  const off = page('presence', { mode: 'all', scroll: 'off' });
  assert.doesNotMatch(off, /lp_scroll=1/);
  const every = page('presence', { mode: 'all', scroll: 'all' });
  assert.match(every, /lp_scroll=1/);
});
