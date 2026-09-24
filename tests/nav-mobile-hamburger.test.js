'use strict';

/**
 * Mobile hamburger: editor Mobile tick + mobileHamburger flag
 * drive which items appear in the compact drawer (header and bar placements).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const demoJs = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
const demoCss = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
const trade = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;
const shell = JSON.parse(fs.readFileSync(path.join(root, 'landing-shell-neutral-v1.template.json'), 'utf8')).html;

describe('nav mobile hamburger editor', () => {
  it('exposes Mobile hamburger toggle and per-item Mobile ticks', () => {
    assert.match(manage, /id="nm-mobile-ham"/);
    assert.match(manage, /Mobile hamburger/);
    assert.match(manage, /class="nm-mobile"/);
    assert.match(manage, /_nm\.mobileHamburger=_mh\.checked/);
    assert.match(manage, /it\.mobile=t\.checked/);
    assert.match(manage, /it\.mobile===false\?'':' checked'/);
    assert.match(manage, /ch\.mobile===false\?'':' checked'/);
  });

  it('exposes hamburger button + drawer style controls', () => {
    assert.match(manage, /id="nm-ham-style-wrap"/);
    assert.match(manage, /Mobile hamburger look/);
    assert.match(manage, /id="nm-ham-btn-style"/);
    assert.match(manage, /id="nm-ham-effect"/);
    assert.match(manage, /id="nm-ham-side"/);
    assert.match(manage, /id="nm-ham-speed"/);
    assert.match(manage, /id="nm-ham-backdrop"/);
    assert.match(manage, /id="nm-ham-stagger"/);
    assert.match(manage, /id="nm-ham-icon-anim"/);
    assert.match(manage, /hamBtnStyle/);
    assert.match(manage, /hamEffect/);
    assert.match(manage, /hamPanelBg/);
    assert.match(manage, /_nmHamStyleVis/);
  });
});

describe('nav mobile hamburger renderer', () => {
  for (const [name, js] of [
    ['demo-shared.js', demoJs],
    ['trade.template.json', trade],
    ['landing-shell-neutral-v1.template.json', shell]
  ]) {
    it(`${name}: filters hamburger by mobileHamburger + item.mobile`, () => {
      assert.match(js, /nm\.mobileHamburger!==false/);
      assert.match(js, /_nmMobOk/);
      assert.match(js, /_nmMobItems/);
      assert.match(js, /_nmMobKids/);
      assert.match(js, /_nmMountHam/);
      assert.match(js, /_nmMountHam\(_nmMobItems\(items\)\)/);
      assert.match(js, /it\.mobile!==false/);
    });
  }

  for (const [name, css] of [
    ['demo-shared.css', demoCss],
    ['trade.template.json', trade],
    ['landing-shell-neutral-v1.template.json', shell]
  ]) {
    it(`${name}: hides header + bar menus on compact mobile`, () => {
      assert.match(css, /html\.lp-compact-nav header\.site \.head-nav\{display:none/);
      assert.match(css, /html\.lp-compact-nav header\.site \.head-menu-btn\{display:inline-flex/);
      assert.match(css, /html\.lp-compact-nav \.nav-menu-sec/);
    });

    it(`${name}: styles button + drawer effects`, () => {
      assert.match(css, /\.ham-bars/);
      assert.match(css, /\.hnm-fx-scale/);
      assert.match(css, /\.hnm-fx-slide-fade/);
      assert.match(css, /\.hnm-stagger/);
      assert.match(css, /\.hnm-bd-blur/);
      assert.match(css, /\.hnm-side-left/);
      assert.match(css, /--hn-ham-fg/);
      assert.match(css, /--hn-ham-panel-bg/);
      assert.match(css, /position:absolute;right:12px/);
    });
  }

  it('renderer applies ham style classes and CSS vars', () => {
    assert.match(demoJs, /hamBtnStyle/);
    assert.match(demoJs, /hamEffect/);
    assert.match(demoJs, /ham-bars/);
    assert.match(demoJs, /hnm-fx-/);
    assert.match(demoJs, /--hn-ham-fg/);
    assert.match(demoJs, /--hn-ham-panel-bg/);
    assert.match(demoJs, /is-open/);
    assert.match(trade, /hamBtnStyle/);
    assert.match(trade, /hnm-fx-/);
  });
});
