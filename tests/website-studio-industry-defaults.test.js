'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { composeWebsiteConcepts } = require('../lib/website-composer');
const { renderDraftPreviewHtml } = require('../lib/theme-studio/render-preview');

const CHROME = '/usr/bin/google-chrome';

const TRADE_LEAK =
  /plumber|plumbing|blocked\s*drain|burst\s*pipes?|flooded\s+weekend|what's the problem|drain\s*fixed|old\s*pipework|leak\s*detection|24\/7\s*emergency|drain\s*cleaning|Gungahlin|Belconnen|upfront pricing|fully licensed ACT/i;

const BRIEFS = [
  {
    id: 'jewellery',
    businessName: 'Pink Diamond Vault',
    industry: 'Luxury Jewellery',
    specialisation: 'Rare Argyle pink diamonds, bespoke engagement rings',
    location: 'Canberra ACT',
    audience: 'Affluent couples',
    desiredStyle: 'Luxury elegant',
    conversionGoal: 'Book a private showroom appointment'
  },
  {
    id: 'coffee',
    businessName: 'Bean Culture',
    industry: 'coffee-event',
    specialisation: 'Mobile specialty coffee carts for weddings',
    location: 'Canberra',
    conversionGoal: 'book-event'
  },
  {
    id: 'lawyer',
    businessName: 'Harbour and Co Legal',
    industry: 'legal',
    specialisation: 'Commercial law for growing businesses',
    location: 'Sydney',
    conversionGoal: 'enquire'
  }
];

function dumpDom(html) {
  const file = path.join('/tmp', 'ws-ind-' + Date.now() + '-' + Math.random().toString(16).slice(2) + '.html');
  fs.writeFileSync(file, html);
  const out = spawnSync(
    CHROME,
    ['--headless=new', '--disable-gpu', '--no-sandbox', '--dump-dom', 'file://' + file],
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 30000 }
  );
  try {
    fs.unlinkSync(file);
  } catch (_e) {
    /* ignore */
  }
  assert.equal(out.status, 0, (out.stderr || '').slice(0, 400));
  return out.stdout || '';
}

describe('Website Studio — industry-aware app defaults', () => {
  it('neutral shell has empty trade fallbacks and marketplace hydrate', () => {
    const shell = require('../landing-shell-neutral-v1.template.json');
    assert.match(shell.html, /var _hd=\[\];/);
    assert.match(shell.html, /var _spfd=\[\];/);
    assert.match(shell.html, /ws-new-apps-apply/);
    assert.match(shell.html, /footer class="site" data-sec="footer"/);
    assert.doesNotMatch(shell.html, TRADE_LEAK);
    assert.match(shell.html, /th\.hivis|--hivis/);
  });

  for (const brief of BRIEFS) {
    it(brief.id + ' drafts own why/quote/footer content and concepts differ structurally', async () => {
      const result = await composeWebsiteConcepts(brief, {
        count: 3,
        allowMockImages: true,
        actor: { isSuperuser: true }
      });
      assert.equal(result.ok, true, JSON.stringify(result.errors || result.discarded));
      assert.ok(result.concepts.length >= 2);

      const orders = new Set(result.concepts.map((c) => c.concept.sectionOrder.join('|')));
      const heroes = new Set(result.concepts.map((c) => c.diagnostics.appSelection.heroAppId));
      const layouts = new Set(result.concepts.map((c) => c.concept.layoutId));
      assert.ok(
        orders.size >= 2 || heroes.size >= 2 || layouts.size >= 2,
        'concepts must differ in structure/hero/layout'
      );

      for (const item of result.concepts) {
        const cfg = item.draftConfig;
        const why = cfg.sections.why;
        if (why && why.on !== false) {
          assert.ok(Array.isArray(why.items) && why.items.length >= 3, 'why.items required');
          assert.doesNotMatch(JSON.stringify(why.items), /plumber|pipework|24\/7/i);
        }
        const quote = cfg.sections.quote;
        if (quote && quote.on !== false) {
          assert.ok(String(quote.sub || '').trim(), 'quote.sub required');
          assert.ok(String(quote.lblJob || '').trim());
          assert.doesNotMatch(quote.sub, /flooded/i);
          assert.doesNotMatch(quote.lblJob, /problem/i);
          assert.ok(Array.isArray(quote.points) && quote.points.length >= 2);
          assert.ok(Array.isArray(quote.jobOptions) && quote.jobOptions.length >= 2);
        }
        const footer = cfg.sections.footer;
        assert.ok(footer && String(footer.blurb || '').trim());
        assert.doesNotMatch(footer.blurb, /fixed-price|emergency/i);

        const html = renderDraftPreviewHtml(cfg, { mode: 'desktop' });
        assert.doesNotMatch(html, TRADE_LEAK);

        const dom = dumpDom(html);
        assert.doesNotMatch(dom, TRADE_LEAK);
        assert.match(dom, new RegExp(brief.businessName.slice(0, 12).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      }
    });
  }

  it('jewellery clarity concept includes reviewHighlights with non-trade items', async () => {
    const result = await composeWebsiteConcepts(BRIEFS[0], {
      count: 3,
      allowMockImages: true,
      actor: { isSuperuser: true }
    });
    const clarity = result.concepts.find((c) => (c.concept.sectionOrder || []).includes('reviewHighlights'));
    assert.ok(clarity, 'expected a reviews-first concept with reviewHighlights');
    const rh = clarity.draftConfig.sections.reviewHighlights;
    assert.ok(Array.isArray(rh.items) && rh.items.length >= 2);
    assert.doesNotMatch(JSON.stringify(rh.items), /Drain fixed|Belconnen|Gungahlin/i);
  });
});
