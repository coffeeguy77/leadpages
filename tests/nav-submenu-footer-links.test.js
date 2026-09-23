'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  syncPageMenuItem,
  removePageMenuItem,
  getPageMenuItem,
  isPageInMenu,
  findPageMenuChildRef
} = require('../lib/lp-nav-menu-sync');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const demoJs = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
const demoCss = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
const trade = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;

describe('nav menu parent/child submenus', () => {
  it('editor supports parent kind, children, and add-parent controls', () => {
    assert.match(manage, /nm-kind/);
    assert.match(manage, /Parent \(submenu\)/);
    assert.match(manage, /id="nm-add-parent"/);
    assert.match(manage, /nm-add-child/);
    assert.match(manage, /nm-child-row/);
    assert.match(manage, /kind:'parent'/);
    assert.match(manage, /children:/);
  });

  it('renderer builds dropdown + mobile nested groups', () => {
    assert.match(demoJs, /_nmIsParent/);
    assert.match(demoJs, /hn-drop/);
    assert.match(demoJs, /hn-sub/);
    assert.match(demoJs, /hnm-group/);
    assert.match(demoJs, /hnm-children/);
    assert.match(demoJs, /nm-drop/);
    assert.match(demoCss, /Nav menu parent\/child submenus/);
    assert.match(demoCss, /header\.site \.hn-drop/);
    assert.match(demoCss, /\.hnm-group/);
    assert.match(trade, /hn-drop/);
    assert.match(trade, /Nav menu parent\/child submenus/);
  });

  it('sync helpers find and remove nested page targets', () => {
    const cfg = {
      sections: {
        navMenu: {
          on: true,
          items: [
            {
              label: 'Services',
              kind: 'parent',
              children: [
                { label: 'Home Mods', target: 'page:home-mods' },
                { label: 'Downsizing', target: 'page:downsizing' }
              ]
            }
          ]
        }
      }
    };
    assert.equal(isPageInMenu(cfg, 'downsizing'), true);
    assert.equal(getPageMenuItem(cfg, 'downsizing').label, 'Downsizing');
    const ref = findPageMenuChildRef(cfg.sections.navMenu.items, 'home-mods');
    assert.equal(ref.child, 0);
    removePageMenuItem(cfg, 'home-mods');
    assert.equal(isPageInMenu(cfg, 'home-mods'), false);
    assert.equal(cfg.sections.navMenu.items[0].children.length, 1);
    syncPageMenuItem(cfg, { slug: 'estate', show: true, label: 'Estate' });
    assert.equal(getPageMenuItem(cfg, 'estate').target, 'page:estate');
  });
});

describe('footer links match button builder', () => {
  it('footer editor uses landing page picker and _blank checkbox', () => {
    assert.match(manage, /function _ftLinkActBlock/);
    assert.match(manage, /lpLandingPageOptsHtml\(page\)/);
    assert.match(manage, /Open in new tab \(_blank\)/);
    assert.match(manage, /ft-link-blank/);
    assert.match(manage, /ft-card-blank/);
    assert.match(manage, /cardLinkBlank/);
  });

  it('renderer respects blank flag for footer url actions', () => {
    assert.match(demoJs, /cardLinkBlank!==false/);
    assert.match(demoJs, /_lBlank=\(l\.blank!==false && l\.linkBlank!==false\)/);
    assert.match(trade, /cardLinkBlank!==false/);
  });
});
