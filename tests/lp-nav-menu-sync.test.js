'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  syncPageMenuItem,
  movePageMenuItem,
  removePageMenuItem,
  isPageInMenu,
  getPageMenuItem
} = require('../lib/lp-nav-menu-sync');

const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');

describe('lp-nav-menu-sync', () => {
  it('adds a page item and turns the menu on', () => {
    const cfg = { sections: { navMenu: { on: false, items: [{ label: 'Home', target: 'home' }] } } };
    const r = syncPageMenuItem(cfg, { slug: 'catering', show: true, label: 'Catering', icon: 'sparkles' });
    assert.equal(cfg.sections.navMenu.on, true);
    assert.equal(r.index, 1);
    assert.deepEqual(r.item, { label: 'Catering', target: 'page:catering', url: '', icon: 'sparkles' });
    assert.equal(isPageInMenu(cfg, 'catering'), true);
  });

  it('updates label/icon and removes when show=false', () => {
    const cfg = { sections: {} };
    syncPageMenuItem(cfg, { slug: 'a', show: true, label: 'A' });
    syncPageMenuItem(cfg, { slug: 'a', show: true, label: 'Alpha', icon: 'star' });
    assert.equal(getPageMenuItem(cfg, 'a').label, 'Alpha');
    assert.equal(getPageMenuItem(cfg, 'a').icon, 'star');
    removePageMenuItem(cfg, 'a');
    assert.equal(isPageInMenu(cfg, 'a'), false);
  });

  it('renames target when slug changes', () => {
    const cfg = { sections: {} };
    syncPageMenuItem(cfg, { slug: 'old', show: true, label: 'Old' });
    syncPageMenuItem(cfg, { slug: 'new', show: true, oldSlug: 'old', label: 'New' });
    assert.equal(isPageInMenu(cfg, 'old'), false);
    assert.equal(getPageMenuItem(cfg, 'new').label, 'New');
  });

  it('moves items left/right in the menu array', () => {
    const cfg = {
      sections: {
        navMenu: {
          on: true,
          items: [
            { label: 'Home', target: 'home' },
            { label: 'A', target: 'page:a' },
            { label: 'B', target: 'page:b' }
          ]
        }
      }
    };
    const m = movePageMenuItem(cfg, 'b', -1);
    assert.equal(m.moved, true);
    assert.deepEqual(cfg.sections.navMenu.items.map(function (it) { return it.target; }), ['home', 'page:b', 'page:a']);
  });
});

describe('Landing page menu quick-add UI', () => {
  it('exposes show-in-menu controls on the LP editor', () => {
    assert.match(manage, /id="lp-show-menu"/);
    assert.match(manage, /Show in site menu/);
    assert.match(manage, /id="lp-menu-label"/);
    assert.match(manage, /id="lp-menu-icon"/);
    assert.match(manage, /id="lp-menu-left"/);
    assert.match(manage, /id="lp-menu-right"/);
    assert.match(manage, /function lpSyncNavMenu/);
    assert.match(manage, /function lpMoveNavMenu/);
    assert.match(manage, /function lpFillMenuUi/);
  });
});
