'use strict';

/**
 * The trade theme serves every kind of business: its built-in defaults must not be plumbing copy,
 * and its structured data must not claim a business type, rating or hours the site never gave.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { hideSectionsOffLandingPage, cfgOwnsResidual } = require('../lib/trade-render-guard');

const html = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'trade.template.json'), 'utf8')).html;
// what visitors and crawlers read (the starter-service filter keeps legacy names on purpose)
const readable = html.replace(/var __plumb=[^;]*;\s*var __starter=\{[^}]*\};/g, '');

test('no plumbing copy in the trade theme defaults', () => {
  const hits = readable.match(/(?<!__)plumb|blocked drain|burst pipe|hot water|sewer|drain clean|drain camera|leak detection|jetting/gi) || [];
  assert.deepEqual(hits, []);
});

test('structured data is plain LocalBusiness — no invented type, rating, hours or FAQ', () => {
  const blocks = html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [];
  assert.equal(blocks.length, 1);
  assert.match(blocks[0], /"@type":"LocalBusiness"/);
  assert.doesNotMatch(blocks[0], /aggregateRating|Plumber|openingHours|FAQPage/);
  assert.doesNotMatch(html, /4\.9 from 212|212 five-star/);
});

test('a switched-off app holding template copy does not make the site "own" plumbing copy', () => {
  const cfg = { sections: { estimateBuilder: { on: false, options: [{ label: 'Blocked drain clearing' }] } } };
  assert.equal(cfgOwnsResidual(cfg), false);
  assert.equal(cfgOwnsResidual({ sections: { services: { on: true, intro: 'Blocked drain clearing' } } }), true);
});

test('landing page: shell sections the page does not use are hidden in first-byte HTML', () => {
  const shell = '<section data-sec="why" class="section">W</section><section data-sec="quote" class="section">Q</section>';
  const out = hideSectionsOffLandingPage(shell, { pageSectionOrder: ['quote'] });
  assert.match(out, /data-sec="why"[^>]*hidden/);
  assert.doesNotMatch(out, /data-sec="quote"[^>]*hidden/);
  // homepage (no page list) is untouched
  assert.equal(hideSectionsOffLandingPage(shell, {}), shell);
});
