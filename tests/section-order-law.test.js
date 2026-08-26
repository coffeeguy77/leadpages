/**
 * Position is the layout law — sectionOrder must drive main#top order.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  resolveSectionOrder,
  applySectionOrderToDom
} = require('../lib/section-order');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const demoShared = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
const tradeTpl = fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');

test('resolveSectionOrder keeps Position keys and appends missing on sections', function() {
  const cfg = {
    sectionOrder: ['hero', 'services', 'quote', 'faq', 'footer'],
    sections: {
      hero: {},
      services: {},
      quote: {},
      faq: {},
      footer: {},
      trustBar: { on: false },
      serviceProcess: { on: true },
      featuredProjects: { on: true },
      onlineQuote: { on: true },
      crew: { on: true }
    }
  };
  const ord = resolveSectionOrder(cfg);
  assert.deepEqual(ord.slice(0, 5), ['hero', 'services', 'quote', 'faq', 'footer']);
  assert.ok(ord.indexOf('serviceProcess') > ord.indexOf('footer'));
  assert.ok(ord.indexOf('featuredProjects') > ord.indexOf('footer'));
  assert.ok(ord.indexOf('onlineQuote') >= 0);
  assert.ok(ord.indexOf('crew') >= 0);
  // Incomplete saved list must not drop hero below later appends.
  assert.ok(ord.indexOf('hero') < ord.indexOf('serviceProcess'));
  assert.ok(ord.indexOf('hero') < ord.indexOf('featuredProjects'));
});

test('resolveSectionOrder pins Trust Bar under Hero', function() {
  const cfg = {
    sectionOrder: ['emerg', 'hero', 'services', 'trustBar', 'faq'],
    sections: { emerg: {}, hero: {}, services: {}, trustBar: {}, faq: {} }
  };
  const ord = resolveSectionOrder(cfg);
  assert.equal(ord.indexOf('trustBar'), ord.indexOf('hero') + 1);
});

test('resolveSectionOrder keeps seoText above FAQ when saved in Position', function() {
  const cfg = {
    sectionOrder: ['hero', 'services', 'seoText', 'faq', 'footer'],
    sections: {
      hero: {},
      services: {},
      seoText: { on: true, h1: 'Premium Event Coffee' },
      faq: {},
      footer: {},
      trustBar: { on: false }
    }
  };
  const ord = resolveSectionOrder(cfg);
  assert.ok(ord.indexOf('seoText') >= 0, 'seoText must stay in resolved order');
  assert.ok(ord.indexOf('seoText') < ord.indexOf('faq'));
});

test('resolveSectionOrder inserts missing seoText above FAQ', function() {
  const cfg = {
    sectionOrder: ['hero', 'services', 'faq', 'footer'],
    sections: {
      hero: {},
      services: {},
      seoText: { on: true },
      faq: {},
      footer: {},
      trustBar: { on: false }
    }
  };
  const ord = resolveSectionOrder(cfg);
  assert.ok(ord.indexOf('seoText') >= 0);
  assert.ok(ord.indexOf('seoText') < ord.indexOf('faq'));
});

test('resolveSectionOrder respects custom Position with How It Works near end', function() {
  const cfg = {
    sectionOrder: [
      'emerg', 'hero', 'instaGallery', 'trustBar', 'services', 'why', 'area',
      'reviews', 'quote', 'faq', 'footer', 'navMenu', 'serviceProcess', 'crew',
      'onlineQuote', 'igProjectFeed', 'featuredProjects'
    ],
    sections: {
      emerg: {}, hero: {}, instaGallery: { on: true }, trustBar: {}, services: {},
      why: {}, area: {}, reviews: {}, quote: {}, faq: {}, footer: {}, navMenu: { on: true },
      serviceProcess: {}, crew: { on: true }, onlineQuote: { on: true },
      igProjectFeed: { on: true }, featuredProjects: { on: true }
    }
  };
  const ord = resolveSectionOrder(cfg);
  assert.ok(ord.indexOf('hero') < ord.indexOf('serviceProcess'));
  assert.ok(ord.indexOf('serviceProcess') < ord.indexOf('featuredProjects'));
  assert.ok(ord.indexOf('onlineQuote') < ord.indexOf('featuredProjects'));
  assert.equal(ord.indexOf('hero'), 1);
  assert.equal(ord.indexOf('trustBar'), 2);
});

test('applySectionOrderToDom clears order:0 trap', function() {
  // Minimal DOM stub
  function el(sec) {
    return {
      getAttribute: function(k) { return k === 'data-sec' ? sec : null; },
      style: { order: '0' },
      querySelector: function() { return null; }
    };
  }
  const hero = el('hero');
  const process = el('serviceProcess');
  const portfolio = el('featuredProjects');
  const nodes = [process, portfolio, hero]; // DOM order wrong
  const mn = {
    style: {},
    children: nodes,
    querySelectorAll: function() { return nodes; },
    querySelector: function(sel) {
      const m = /data-sec="([^"]+)"/.exec(sel);
      if (!m) return null;
      return nodes.filter(function(n) { return n.getAttribute('data-sec') === m[1]; })[0] || null;
    }
  };
  const applied = applySectionOrderToDom(['hero', 'serviceProcess', 'featuredProjects'], mn);
  assert.deepEqual(applied, ['hero', 'serviceProcess', 'featuredProjects']);
  assert.equal(hero.style.order, '1');
  assert.equal(process.style.order, '2');
  assert.equal(portfolio.style.order, '3');
});

test('resolveSectionOrder remaps legacy promotions-hero to promotions', function() {
  const cfg = {
    sectionOrder: ['hero', 'promotions-hero', 'services', 'promotions-inline', 'quote', 'footer'],
    sections: {
      hero: {},
      services: {},
      quote: {},
      footer: {},
      promotions: { items: [{ title: 'Summer sale' }] },
      trustBar: { on: false }
    }
  };
  const ord = resolveSectionOrder(cfg);
  assert.ok(ord.indexOf('promotions') >= 0, 'promotions must appear after legacy key remap');
  assert.equal(ord.indexOf('promotions-hero'), -1);
  assert.equal(ord.indexOf('promotions-inline'), -1);
  assert.ok(ord.indexOf('promotions') < ord.indexOf('quote'));
});

test('resolveSectionOrder includes installed promotions with default on', function() {
  const cfg = {
    sectionOrder: ['hero', 'services', 'quote', 'footer'],
    sections: {
      hero: {},
      services: {},
      quote: {},
      footer: {},
      promotions: { items: [] },
      trustBar: { on: false }
    }
  };
  const ord = resolveSectionOrder(cfg);
  assert.ok(ord.indexOf('promotions') >= 0, 'installed promotions must be appendable to Position');
});

test('normalizeSectionOrder dedupes hero and inline into one promotions key', function() {
  const { normalizeSectionOrder } = require('../lib/section-order');
  assert.deepEqual(
    normalizeSectionOrder(['hero', 'promotions-hero', 'promotions-inline', 'quote']),
    ['hero', 'promotions', 'quote']
  );
});

test('manage Position list normalizes legacy promotions keys', function() {
  assert.match(manage, /STALE_PROMOTIONS_ORDER_KEYS/);
  assert.match(manage, /function _normalizeOrderKeys/);
  assert.match(manage, /function _optionalInstalled/);
  assert.match(manage, /function _migrateLegacyPromotionsSections/);
  assert.match(manage, /promotions-hero.*promotions-inline.*key='promotions'/s);
});

test('manage never overwrites Position from marketplace when sectionOrder exists', function() {
  assert.match(manage, /Position \(Page editor sectionOrder\) is the layout law/);
  assert.match(manage, /Only seed sectionOrder from marketplace slots when the site has none yet/);
  assert.match(manage, /function _syncSectionOrder/);
  assert.match(manage, /Trust Bar always sits under/);
  assert.match(manage, /OPTIONAL_COMPONENTS\s*=\s*\[[^\]]*certifications/);
  assert.match(manage, /OPTIONAL_COMPONENTS\s*=\s*\[[^\]]*promotions/);
  assert.match(manage, /renderPositioningThemes/);
  assert.match(manage, /nav-themes/);
});

test('positioning layouts API and SQL exist', function() {
  const api = fs.readFileSync(path.join(root, 'api/api-positioning-layouts.js'), 'utf8');
  const sql = fs.readFileSync(path.join(root, 'db/positioning_layouts.sql'), 'utf8');
  const lib = fs.readFileSync(path.join(root, 'lib/positioning-layouts.js'), 'utf8');
  assert.match(api, /action === 'apply'/);
  assert.match(api, /fill_empty/);
  assert.match(api, /demo_replace/);
  assert.match(sql, /create table if not exists public\.positioning_layouts/);
  assert.match(lib, /IDENTITY_TOP_KEYS/);
  assert.match(lib, /applyPositioningLayout/);
});

test('live applyCfg merges all data-sec nodes after Position list', function() {
  assert.match(demoShared, /__kids\.forEach\(__pushNode\)/);
  assert.match(demoShared, /__ord\.forEach\(function\(__n,__ix\)/);
  assert.match(tradeTpl, /__kids\.forEach\(__pushNode\)/);
  assert.match(render, /resolveSectionOrder/);
});

test('injectSectionOrderCss gives promotions-inline its own flex slot after hero', function() {
  const { injectSectionOrderCss } = require('../lib/trade-render-guard');
  const html = injectSectionOrderCss('<html><head></head><body></body></html>', {
    sectionOrder: ['hero', 'scrollingSponsorBanner', 'promotions', 'services'],
    sections: {
      hero: {},
      scrollingSponsorBanner: { on: true },
      promotions: { on: true },
      services: {}
    }
  });
  assert.match(html, /promotions-hero"\]\{order:4!important\}/);
  assert.match(html, /promotions-inline"\]\{order:5!important\}/);
  assert.match(html, /services"\]\{order:6!important\}/);
});
