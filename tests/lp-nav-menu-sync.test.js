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
  getPageMenuItem,
  getPageMenuPlacement,
  listParentItems,
  findPageMenuChildRef
} = require('../lib/lp-nav-menu-sync');

const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');

describe('lp-nav-menu-sync', () => {
  it('adds a page item and turns the menu on', () => {
    const cfg = { sections: { navMenu: { on: false, items: [{ label: 'Home', target: 'home' }] } } };
    const r = syncPageMenuItem(cfg, { slug: 'catering', show: true, label: 'Catering', icon: 'sparkles' });
    assert.equal(cfg.sections.navMenu.on, true);
    assert.equal(r.index, 1);
    assert.equal(r.child, -1);
    assert.equal(r.item.label, 'Catering');
    assert.equal(r.item.target, 'page:catering');
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

  it('nests a page under a new parent submenu', () => {
    const cfg = { sections: { navMenu: { on: true, items: [{ label: 'Home', target: 'home' }] } } };
    const r = syncPageMenuItem(cfg, {
      slug: 'home-mods',
      show: true,
      label: 'Home Modifications',
      under: { create: 'Services' }
    });
    assert.equal(r.child, 0);
    assert.equal(cfg.sections.navMenu.items[1].kind, 'parent');
    assert.equal(cfg.sections.navMenu.items[1].label, 'Services');
    assert.equal(cfg.sections.navMenu.items[1].children[0].target, 'page:home-mods');
    const place = getPageMenuPlacement(cfg, 'home-mods');
    assert.equal(place.parentIndex, 1);
    assert.equal(place.parentLabel, 'Services');
    assert.equal(listParentItems(cfg.sections.navMenu.items).length, 1);
  });

  it('moves nested siblings and relocates to top level', () => {
    const cfg = { sections: { navMenu: { on: true, items: [] } } };
    syncPageMenuItem(cfg, { slug: 'a', show: true, label: 'A', under: { create: 'Services' } });
    syncPageMenuItem(cfg, { slug: 'b', show: true, label: 'B', under: { create: 'Services' } });
    const m = movePageMenuItem(cfg, 'b', -1);
    assert.equal(m.moved, true);
    assert.equal(cfg.sections.navMenu.items[0].children[0].target, 'page:b');
    syncPageMenuItem(cfg, { slug: 'b', show: true, under: 'top' });
    const ref = findPageMenuChildRef(cfg.sections.navMenu.items, 'b');
    assert.equal(ref.child, -1);
    assert.equal(isPageInMenu(cfg, 'a'), true);
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

  it('exposes parent / submenu placement on the LP editor', () => {
    assert.match(manage, /id="lp-menu-under"/);
    assert.match(manage, /Place in menu/);
    assert.match(manage, /New parent menu/);
    assert.match(manage, /id="lp-menu-new-parent"/);
    assert.match(manage, /function lpFillMenuUnderOpts/);
    assert.match(manage, /function lpFindNavRef/);
    assert.match(manage, /under:on\?underSpec\(\)/);
    assert.match(manage, /Under: /);
  });
});
