'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { composeWebsiteConcepts } = require('../lib/website-composer');
const {
  renderDraftPreviewHtml,
  injectSiteConfig,
  heroContentOk,
  TRADE_RESIDUAL
} = require('../lib/theme-studio/render-preview');

const CHROME = '/usr/bin/google-chrome';
const PLUMBING = /we'll clear it today|burst pipes|blocked drain|licensed canberra plumber/i;

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
    id: 'coffee-events',
    businessName: 'Bean Culture',
    industry: 'coffee-event',
    specialisation: 'Mobile specialty coffee carts for weddings and corporate events',
    location: 'Canberra',
    audience: 'Wedding couples and event planners',
    desiredStyle: 'Warm artisan',
    conversionGoal: 'book-event'
  },
  {
    id: 'lawyer',
    businessName: 'Harbour and Co Legal',
    industry: 'legal',
    specialisation: 'Commercial law for growing Australian businesses',
    location: 'Sydney',
    audience: 'Business owners',
    desiredStyle: 'Professional restrained',
    conversionGoal: 'enquire'
  },
  {
    id: 'hair-salon',
    businessName: 'Luxe Hair Studio',
    industry: 'hair-salon',
    specialisation: 'Colour, cuts and premium salon care',
    location: 'Melbourne',
    audience: 'Salon clients',
    desiredStyle: 'Soft premium',
    conversionGoal: 'book'
  }
];

function dumpDom(html) {
  const file = path.join('/tmp', 'ws-leak-' + Date.now() + '-' + Math.random().toString(16).slice(2) + '.html');
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

describe('Website Studio preview — no plumbing hero leak', () => {
  it('neutral shell asset keeps hivis theme token and has no plumbing residual', () => {
    const shell = require('../landing-shell-neutral-v1.template.json');
    assert.match(shell.html, /th\.hivis|--hivis/);
    assert.doesNotMatch(shell.html, /setv\(th\.,'--'/);
    assert.doesNotMatch(shell.html, PLUMBING);
  });

  it('injectSiteConfig does not corrupt window.__SITE_CONFIG__ reads', () => {
    const html = injectSiteConfig(
      'try{cfg=window.__SITE_CONFIG__||window.SITE_CONFIG}catch(e){}\nconst SITE_CONFIG = __SITE_CONFIG__;\n',
      { name: 'Test Biz', sections: { hero: { on: true, title: 'Hello', sub: 'World' } } }
    );
    assert.match(html, /window\.__SITE_CONFIG__/);
    assert.doesNotMatch(html, /window\.\{/);
    assert.match(html, /const SITE_CONFIG = \{/);
  });

  it('missing hero content returns validation page instead of trade defaults', () => {
    const html = renderDraftPreviewHtml({
      name: 'X',
      __websiteComposer: { contentInheritance: 'none', rendererShellId: 'landing-shell-neutral-v1' },
      sectionOrder: ['hero', 'faq'],
      sections: { hero: { on: true }, faq: { on: true } }
    });
    assert.match(html, /Preview blocked|validation/i);
    assert.doesNotMatch(html, PLUMBING);
    assert.equal(heroContentOk({ sectionOrder: ['hero'], sections: { hero: { on: true } } }).ok, false);
  });

  for (const brief of BRIEFS) {
    it(brief.id + ' concepts never render plumbing hero content', async () => {
      const result = await composeWebsiteConcepts(brief, {
        count: 3,
        allowMockImages: true,
        actor: { isSuperuser: true }
      });
      assert.equal(result.ok, true, JSON.stringify(result.errors || result.discarded));
      assert.ok(result.concepts.length >= 2);

      for (const item of result.concepts) {
        const cfg = item.draftConfig;
        assert.equal(cfg.__websiteComposer.contentInheritance, 'none');
        assert.equal(heroContentOk(cfg).ok, true);

        const html = renderDraftPreviewHtml(cfg, { mode: 'desktop' });
        assert.doesNotMatch(html, PLUMBING);
        assert.doesNotMatch(html, /window\.\{/);
        assert.doesNotMatch(html, TRADE_RESIDUAL);

        // Static document must already be clean (no FOUC plumbing)
        assert.doesNotMatch(html, /We'll clear it today/i);

        const dom = dumpDom(html);
        assert.doesNotMatch(dom, PLUMBING);
        // Business or composed hero title should appear after applyCfg
        const title =
          (cfg.sections.hero && cfg.sections.hero.title) ||
          (cfg.sections.splitHero && cfg.sections.splitHero.title) ||
          (cfg.sections.heroSlider &&
            cfg.sections.heroSlider.slides &&
            cfg.sections.heroSlider.slides[0] &&
            cfg.sections.heroSlider.slides[0].heading) ||
          brief.businessName;
        assert.match(dom, new RegExp(String(title).slice(0, 24).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      }
    });
  }

  it('does not modify live trade shell asset', () => {
    const trade = require('../trade.template.json');
    assert.match(trade.html, /We'll clear it today|Blocked drain/i);
  });
});
