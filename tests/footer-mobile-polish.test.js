/**
 * Footer + logo mobile polish: independent size/placement, support hide-on-mobile,
 * support visual (map/icon/image), column link vs text-box card modes.
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
const trade = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;

describe('Header logo independent mobile placement', () => {
  it('manage exposes mobile position and XY offsets', () => {
    assert.match(manage, /id="lg-pos-m"/);
    assert.match(manage, /id="lg-offxm"/);
    assert.match(manage, /id="lg-offym"/);
    assert.match(manage, /L\.positionM=/);
    assert.match(manage, /L\.offsetXM=/);
    assert.match(manage, /L\.offsetYM=/);
  });

  it('applyCfg applies mobile offsets and position classes', () => {
    assert.match(js, /offsetXM!=null/);
    assert.match(js, /positionM==='center'/);
    assert.match(js, /lp-logo-m-/);
    assert.match(js, /--hdr-logo-ox-m-val/);
    assert.match(trade, /offsetXM!=null/);
    assert.match(trade, /lp-logo-m-/);
  });
});

describe('Footer brand logo independent mobile size/placement', () => {
  it('manage has desktop + mobile logo height/offset controls', () => {
    assert.match(manage, /id="ft-logohm"/);
    assert.match(manage, /id="ft-logoxm"/);
    assert.match(manage, /id="ft-logoym"/);
    assert.match(manage, /logoHeightM/);
    assert.match(manage, /logoOffsetXM/);
    assert.match(manage, /logoOffsetYM/);
  });

  it('CSS and JS drive mobile footer logo via CSS vars (no inline transform)', () => {
    assert.match(css, /--foot-logo-h-m/);
    assert.match(css, /--foot-logo-x-m/);
    assert.match(css, /foot-hide-support-m/);
    assert.match(js, /logoHeightM/);
    assert.match(js, /--foot-logo-h-m/);
    assert.match(js, /removeProperty\('transform'\)/);
    assert.match(trade, /--foot-logo-h-m/);
    assert.match(trade, /logoHeightM/);
  });
});

describe('Support card mobile + visual options', () => {
  it('manage can hide support on mobile and choose map/icon/image', () => {
    assert.match(manage, /id="ft-support-mobile"/);
    assert.match(manage, /showSupportMobile/);
    assert.match(manage, /id="ft-support-vis"/);
    assert.match(manage, /Australia map/);
    assert.match(manage, /id="ft-support-icon"/);
    assert.match(manage, /id="ft-support-img"/);
    assert.match(manage, /supportVisual/);
  });

  it('renderer applies hide-on-mobile and support visual modes', () => {
    assert.match(js, /foot-hide-support-m/);
    assert.match(js, /supportVisual==='icon'/);
    assert.match(js, /f-support-icon/);
    assert.match(js, /f-support-img/);
    assert.match(css, /f-support-icon/);
    assert.match(css, /f-col-card-box/);
    assert.match(trade, /foot-hide-support-m/);
    assert.match(trade, /supportVisual/);
  });
});

describe('Footer columns: links list or text-box card', () => {
  it('manage column editor supports modes and link actions', () => {
    assert.match(manage, /ft-col-mode/);
    assert.match(manage, /List with links/);
    assert.match(manage, /Text-box card/);
    assert.match(manage, /ft-link-act/);
    assert.match(manage, /Landing page/);
    assert.match(manage, /Custom app position/);
    assert.match(manage, /ft-card-linkon/);
    assert.match(manage, /Whole card is a link/);
    assert.match(manage, /ft-card-btnlab/);
  });

  it('renderer builds card columns with decorative button', () => {
    assert.match(js, /mode==='card'/);
    assert.match(js, /f-col-card-btn/);
    assert.match(js, /cardLinkOn===true/);
    assert.match(js, /_ftResolveHref/);
    assert.match(css, /pointer-events:none/);
    assert.match(trade, /f-col-card-btn/);
    assert.match(trade, /cardLinkOn===true/);
  });
});
