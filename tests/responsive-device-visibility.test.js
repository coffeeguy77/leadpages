/**
 * Responsive breakpoints + per-app phone/tablet visibility.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const bp = require(path.join(root, 'lib/breakpoints'));
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
const render = fs.readFileSync(path.join(root, 'api/render.js'), 'utf8');
const trade = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;

describe('lib/breakpoints', () => {
  it('exposes platform defaults and resolves platform vs custom', () => {
    const plat = bp.resolveBreakpoints({});
    assert.equal(plat.source, 'platform');
    assert.equal(plat.mobileLandscapeMax, 560);
    assert.equal(plat.tabletLandscapeMax, 900);
    assert.equal(plat.desktopMin, 901);

    const custom = bp.resolveBreakpoints({
      breakpoints: {
        source: 'custom',
        version: 1,
        mobilePortraitMax: 400,
        mobileLandscapeMax: 500,
        tabletPortraitMax: 700,
        tabletLandscapeMax: 850
      }
    });
    assert.equal(custom.source, 'custom');
    assert.equal(custom.mobileLandscapeMax, 500);
    assert.equal(custom.desktopMin, 851);
  });

  it('does not treat missing source as custom (auto-follows platform)', () => {
    const r = bp.resolveBreakpoints({
      breakpoints: { mobileLandscapeMax: 999 }
    });
    assert.equal(r.source, 'platform');
    assert.equal(r.mobileLandscapeMax, 560);
  });

  it('emits concrete hide media queries', () => {
    const css = bp.breakpointsHideCss(bp.resolveBreakpoints({}));
    assert.match(css, /@media\(max-width:560px\)\{\.lp-hide-mobile/);
    assert.match(css, /@media\(min-width:561px\) and \(max-width:900px\)\{\.lp-hide-tablet/);
  });

  it('detects outdated custom versions', () => {
    assert.equal(bp.breakpointsOutdated({ breakpoints: { source: 'custom', version: 0 } }), true);
    assert.equal(bp.breakpointsOutdated({ breakpoints: { source: 'custom', version: 1 } }), false);
    assert.equal(bp.breakpointsOutdated({}), false);
  });
});

describe('editor + renderer wiring', () => {
  it('manage.html has device visibility and breakpoint settings UI', () => {
    assert.match(manage, /deviceVisRowHtml/);
    assert.match(manage, /Show on phones/);
    assert.match(manage, /Show on tablets/);
    assert.match(manage, /hideOnMobile/);
    assert.match(manage, /hideOnTablet/);
    assert.match(manage, /_bpSettingsCardHtml/);
    assert.match(manage, /Restore LeadPages defaults/);
    assert.match(manage, /Update to latest defaults/);
    assert.match(manage, /Undo last update/);
    assert.match(manage, /Responsive breakpoints/);
  });

  it('demo-shared applies breakpoints and device hide classes', () => {
    assert.match(js, /function applyBreakpoints/);
    assert.match(js, /function applyDeviceVisibility/);
    assert.match(js, /lp-hide-mobile/);
    assert.match(js, /lp-hide-tablet/);
    assert.match(js, /hideOnMobile===true/);
    assert.match(trade, /applyBreakpoints/);
    assert.match(trade, /lp-hide-mobile/);
  });

  it('api/render injects breakpoint CSS', () => {
    assert.match(render, /lib\/breakpoints/);
    assert.match(render, /breakpointsHideCss/);
    assert.match(render, /--lp-bp-mobile-l/);
  });
});
