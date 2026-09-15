'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  compileBlueprintToConfig,
  stubSectionsOutsideOrder,
} = require('../lib/layout-composer/compile');
const { resolveSectionOrder } = require('../lib/section-order');
const { suggestApps } = require('../lib/layout-composer/interview');

const root = path.join(__dirname, '..');
const apiInterview = fs.readFileSync(path.join(root, 'api/layout-composer/interview.js'), 'utf8');
const createSiteSrc = fs.readFileSync(path.join(root, 'api/layout-composer/create-site.js'), 'utf8');
const manageSrc = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const composerSrc = fs.readFileSync(path.join(root, 'layout-composer.html'), 'utf8');

const CONFIRMED_ORDER = [
  'navMenu',
  'heroBeforeAfter',
  'trustBar',
  'serviceProcess',
  'searchCanvas',
  'faq',
  'why',
  'reviews',
  'quote',
  'footer',
];

function roofVentBlueprint() {
  return {
    pages: [
      {
        id: 'home',
        path: '/',
        sections: CONFIRMED_ORDER.map(function (key) {
          return { key: key, enabled: true };
        }),
      },
    ],
  };
}

describe('Layout Composer structure lock', () => {
  it('compile + resolve keeps confirmed order and does not inject classic stack', () => {
    const compiled = compileBlueprintToConfig(roofVentBlueprint(), {
      identity: {
        name: 'Corrugated Roof Vents',
        trade: 'Roof Ventilation Products',
        location: 'Australia',
      },
    });
    assert.equal(compiled.config._layoutComposer.structureLocked, true);
    const order = resolveSectionOrder(compiled.config);
    assert.deepEqual(order, CONFIRMED_ORDER);
    ['emerg', 'hero', 'crew', 'area', 'services'].forEach(function (k) {
      assert.equal(order.indexOf(k), -1, 'must not inject ' + k);
      assert.equal(compiled.config.sections[k].on, false, k + ' stubbed off');
    });
  });

  it('stubSectionsOutsideOrder turns classic sections off on handoff configs', () => {
    const locked = ['heroBeforeAfter', 'trustBar', 'faq'];
    const cfg = {
      sectionOrder: locked.slice(),
      sections: {
        heroBeforeAfter: { on: true },
        trustBar: { on: true },
        faq: { on: true },
        emerg: { on: true },
        hero: { on: true },
        why: { on: true },
      },
      _layoutComposer: {
        structureLocked: true,
        lockedOrder: locked.slice(),
      },
    };
    stubSectionsOutsideOrder(cfg, locked);
    assert.equal(cfg.sections.emerg.on, false);
    assert.equal(cfg.sections.hero.on, false);
    assert.equal(cfg.sections.why.on, false);
    assert.equal(cfg.sections.faq.on, true);
    const order = resolveSectionOrder(cfg);
    assert.equal(order.indexOf('emerg'), -1);
    assert.equal(order.indexOf('hero'), -1);
  });

  it('does not auto-select beforeAfter when heroBeforeAfter is already in the layout', () => {
    const apps = suggestApps(
      {
        businessName: 'Corrugated Roof Vents',
        trade: 'Roof Ventilation Products',
        location: 'Australia',
        services: ['metal corrugated roof ventilators'],
        customers: ['Homeowners'],
        differentiator: 'low profile metal roof ventilators',
        preferredCta: 'Visit our online shop',
        tone: 'premium',
        serviceAreas: ['Australia'],
      },
      ['heroBeforeAfter', 'trustBar', 'faq', 'reviews']
    );
    const ba = apps.find(function (a) {
      return a.key === 'beforeAfter';
    });
    assert.ok(ba);
    assert.equal(ba.defaultSelected, false);
    assert.equal(ba.status, 'related_in_layout');
  });

  it('wires OpenAI chip options into interview polish', () => {
    assert.match(apiInterview, /ai\.options/);
    assert.match(apiInterview, /step\.options = out\.options/);
  });

  it('create-site re-stubs and re-locks structure', () => {
    assert.match(createSiteSrc, /stubSectionsOutsideOrder/);
    assert.match(createSiteSrc, /structureLocked:\s*true/);
  });

  it('manage _orderList respects structureLocked', () => {
    assert.match(manageSrc, /structureLocked/);
    assert.match(manageSrc, /lockedOrder/);
  });

  it('composer UI blocks related before/after adds', () => {
    assert.match(composerSrc, /BEFORE_AFTER_FAMILY/);
    assert.match(composerSrc, /related_in_layout/);
    assert.match(composerSrc, /covered by your layout/);
  });
});
