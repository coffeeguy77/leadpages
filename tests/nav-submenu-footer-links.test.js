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

  it('allows dragging a menu item onto a parent to nest as a sub-item', () => {
    assert.match(manage, /nm-drop-nest/);
    assert.match(manage, /asNestPayload/);
    assert.match(manage, /dropModeFor/);
    assert.match(manage, /Drag onto another parent/);
    assert.match(manage, /data-parent="/);
  });

  it('renderer builds dropdown + mobile nested groups', () => {
    assert.match(demoJs, /_nmIsParent/);
    assert.match(demoJs, /hn-drop/);
    assert.match(demoJs, /hn-sub/);
    assert.match(demoJs, /hnm-group/);
    assert.match(demoJs, /hnm-children/);
    assert.match(demoJs, /nm-drop/);
    assert.match(demoJs, /_nmWireDrops/);
    assert.match(demoCss, /Nav menu parent\/child/);
    assert.match(demoCss, /header\.site \.hn-drop/);
    assert.match(demoCss, /\.hnm-group/);
    assert.match(demoCss, /hn-drop\.hn-open>\.hn-sub/);
    assert.match(demoCss, /hn-sub-link/);
    assert.match(demoCss, /hn-sub::before/); // hover bridge (transparent), not diamond caret
    assert.doesNotMatch(demoCss, /hn-sub::before\{[^}]*rotate\(45deg\)/);
    assert.match(trade, /hn-drop/);
    assert.match(trade, /Nav menu parent\/child/);
    assert.match(trade, /_nmWireDrops/);
  });

  it('parents match link size/weight; no title tooltips on menu links', () => {
    assert.match(demoCss, /button\.hn-link\.hn-parent/);
    assert.match(demoCss, /font-weight:700;font-size:16px/);
    assert.match(demoCss, /\.hn-sub-link\{[\s\S]*?font-weight:700;font-size:16px/);
    assert.match(demoCss, /color:var\(--hn-fg/);
    assert.match(demoCss, /min-height:38px/);
    assert.doesNotMatch(demoJs, /hn-sub-link\\" href=\\"[^"]+\\" title=/);
    assert.doesNotMatch(demoJs, /hn-parent\\" aria-haspopup=\\"true\\" aria-expanded=\\"false\\" title=/);
  });

  it('hover stroke does not resize buttons (box-shadow, not border-width)', () => {
    assert.match(demoCss, /box-shadow:0 0 0 var\(--hn-sub-hover-stroke-w/);
    assert.match(demoCss, /box-shadow:0 0 0 var\(--hn-hover-stroke-w/);
    assert.doesNotMatch(demoCss, /hn-sub-link:hover[^}]*border-width:var\(--hn-sub-hover-stroke-w/);
    assert.doesNotMatch(demoCss, /hn-drop\.hn-open>\.hn-parent\{[^}]*border-width:/);
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

describe('nav menu parent / submenu colour controls', () => {
  const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
  const demoJs = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
  const demoCss = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.css'), 'utf8');
  const trade = JSON.parse(fs.readFileSync(path.join(root, 'trade.template.json'), 'utf8')).html;

  it('editor exposes Parent + Sub colour sections only', () => {
    assert.match(manage, />Parent<\/h3>/);
    assert.match(manage, />Sub<\/h3>/);
    assert.match(manage, /id="nm-fg"/);
    assert.match(manage, /id="nm-subbg"/);
    assert.match(manage, /id="nm-hstroke"/);
    assert.match(manage, /id="nm-subhstroke"/);
    assert.match(manage, /_nmCol\('subBg'/);
    assert.match(manage, /_nmCol\('hoverStroke'/);
    assert.doesNotMatch(manage, /id="nm-pfg"/);
    assert.doesNotMatch(manage, /_nmCol\('parentFg'/);
    assert.doesNotMatch(manage, /Submenu panel/);
    assert.doesNotMatch(manage, /Link \/ text colour/);
  });

  it('renderer sets Parent (--hn-*) + Sub (--hn-sub-*) vars; parents use --hn-fg not inherit', () => {
    assert.match(demoJs, /--hn-sub-bg/);
    assert.match(demoJs, /--hn-hover-stroke/);
    assert.match(demoJs, /--hn-sub-hover-stroke/);
    assert.match(demoJs, /--hn-fg/);
    assert.match(demoJs, /_autoFg/);
    assert.match(demoCss, /button\.hn-link\.hn-parent/);
    assert.match(demoCss, /color:var\(--hn-fg/);
    assert.doesNotMatch(demoCss, /button\.hn-link\.hn-parent\{[^}]*color:inherit/);
    assert.doesNotMatch(demoJs, /--hn-parent-fg/);
    assert.doesNotMatch(demoCss, /--hn-parent-stroke-w/);
    assert.match(trade, /--hn-sub-bg/);
    assert.match(trade, /_autoFg/);
  });
});
