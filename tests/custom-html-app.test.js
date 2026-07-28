/**
 * Custom HTML marketplace app — section order, template mount, runtime helper.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const manage = fs.readFileSync(path.join(root, 'manage.html'), 'utf8');
const {
  OPTIONAL_SECTIONS,
  OFF_BY_DEFAULT,
  resolveSectionOrder
} = require('../lib/section-order');
const { SECTION_CATEGORY } = require('../lib/marketplace-categories');
const appContent = require('../marketplace/app-content.json');
const sellTemplates = require('../marketplace/sell-templates.json');
const fieldDefs = require('../marketplace/playground-field-defs.json');

test('customHtml is optional / off-by-default for Position', function () {
  assert.ok(OPTIONAL_SECTIONS.indexOf('customHtml') >= 0);
  assert.ok(OFF_BY_DEFAULT.indexOf('customHtml') >= 0);
  assert.match(manage, /OPTIONAL_COMPONENTS\s*=\s*\[[^\]]*customHtml/);
  assert.match(manage, /OFF_BY_DEFAULT_SECTIONS\s*=\s*\[[^\]]*customHtml/);
});

test('resolveSectionOrder places customHtml before quote when on', function () {
  const off = resolveSectionOrder({
    sections: { customHtml: { on: false }, quote: {} }
  });
  assert.ok(off.indexOf('customHtml') < 0);

  const on = resolveSectionOrder({
    sections: { customHtml: { on: true }, quote: {} }
  });
  assert.ok(on.indexOf('customHtml') >= 0);
  assert.ok(on.indexOf('customHtml') < on.indexOf('quote'));
});

test('manage _orderList includes customHtml when enabled', function () {
  const layoutsMatch = manage.match(/const LAYOUTS\s*=\s*(\{[\s\S]*?\});\s*\n\s*function getLayout/);
  assert.ok(layoutsMatch, 'LAYOUTS present');
  const optMatch = manage.match(/const OPTIONAL_COMPONENTS\s*=\s*(\[[^\]]+\])/);
  const offMatch = manage.match(/const OFF_BY_DEFAULT_SECTIONS\s*=\s*(\[[^\]]+\])/);
  const startEnsure = manage.indexOf('function _orderEnsure(base, id, afterIds)');
  const endList = manage.indexOf('function wireOrder(c)');
  assert.ok(startEnsure > 0 && endList > startEnsure);

  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    'LAYOUTS = ' + layoutsMatch[1] + ';\n'
    + 'OPTIONAL_COMPONENTS = ' + optMatch[1] + ';\n'
    + 'OFF_BY_DEFAULT_SECTIONS = ' + offMatch[1] + ';\n'
    + 'function getLayout(layoutId){ return (layoutId && LAYOUTS[layoutId]) ? LAYOUTS[layoutId] : LAYOUTS.classic; }\n'
    + 'function _secOn(c,id){ var s=(c&&c.sections&&c.sections[id])||{}; return (OFF_BY_DEFAULT_SECTIONS.indexOf(id)>=0)?(s.on===true):(s.on!==false); }\n'
    + manage.slice(startEnsure, endList),
    sandbox
  );

  const ord = sandbox._orderList({
    layout: 'classic',
    sections: { customHtml: { on: true }, quote: {} }
  });
  assert.ok(ord.indexOf('customHtml') >= 0);
  assert.ok(ord.indexOf('customHtml') < ord.indexOf('quote'));
});

test('marketplace catalog + demo coverage for customHtml', function () {
  assert.ok(appContent.customHtml);
  assert.ok(sellTemplates.customHtml);
  assert.ok(fieldDefs.customHtml);
  assert.equal(SECTION_CATEGORY.customHtml, 'platform-tools');
  assert.ok(fs.existsSync(path.join(root, 'marketplace/demos/demo-customHtml.html')));
  assert.ok(fs.existsSync(path.join(root, 'assets/lp-custom-html.js')));
  assert.ok(fs.existsSync(path.join(root, 'assets/apps/transfer-matcher/body.html')));
  assert.ok(fs.existsSync(path.join(root, 'assets/apps/transfer-matcher/app.js')));
  assert.ok(fs.existsSync(path.join(root, 'assets/apps/transfer-matcher/app.css')));
});

test('trade + landing templates mount Custom HTML', function () {
  ['trade.template.json', 'landing-shell-neutral-v1.template.json'].forEach(function (name) {
    const html = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8')).html;
    assert.match(html, /data-sec="customHtml"/, name + ' section');
    assert.match(html, /data-lp-custom-html/, name + ' mount');
    assert.match(html, /lp-custom-html\.js/, name + ' runtime');
    assert.match(html, /lpApplyCustomHtml/, name + ' apply hook');
  });
});

test('lp-custom-html.js injects HTML and loads asset URLs', function () {
  const src = fs.readFileSync(path.join(root, 'assets/lp-custom-html.js'), 'utf8');
  const links = [];
  const scripts = [];
  const sec = {
    style: {
      display: 'none',
      background: '',
      removeProperty: function () {},
      setProperty: function (k, v) { this[k] = v; this['__imp_' + k] = true; }
    },
    classList: { toggle: function () {} },
    querySelector: function () { return null; }
  };
  const mount = {
    id: 'm1',
    innerHTML: '',
    _attrs: {},
    setAttribute: function (k, v) { this._attrs[k] = v; },
    getAttribute: function (k) { return this._attrs[k] || null; },
    removeAttribute: function (k) { delete this._attrs[k]; },
    closest: function () { return sec; }
  };
  const sandbox = {
    window: {},
    document: {
      // loading avoids auto-boot during script eval; we call APIs explicitly
      readyState: 'loading',
      head: {
        appendChild: function (n) { if (n && n.rel === 'stylesheet') links.push(n.href); }
      },
      body: {
        appendChild: function (n) {
          if (n && n.tagName === 'SCRIPT') {
            scripts.push(n.src);
            n.setAttribute('data-lp-ch-ready', '1');
            if (typeof n.onload === 'function') n.onload();
          }
        }
      },
      getElementById: function () { return null; },
      querySelector: function () { return null; },
      querySelectorAll: function () { return [mount]; },
      createElement: function (tag) {
        const el = {
          tagName: String(tag).toUpperCase(),
          id: '',
          rel: '',
          href: '',
          src: '',
          async: true,
          style: { setProperty: function () {}, removeProperty: function () {} },
          classList: { toggle: function () {} },
          setAttribute: function (k, v) { el[k] = v; this._attrs = this._attrs || {}; this._attrs[k] = v; },
          getAttribute: function (k) { return (this._attrs && this._attrs[k]) || el[k] || null; },
          addEventListener: function () {},
          closest: function () { return sec; },
          querySelector: function () { return null; }
        };
        return el;
      },
      addEventListener: function () {}
    },
    Promise: Promise,
    console: console,
    globalThis: null
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(src + '\nthis.lpApplyCustomHtml = lpApplyCustomHtml; this.lpRefreshCustomHtml = lpRefreshCustomHtml;', sandbox);

  sandbox.lpApplyCustomHtml({
    on: true,
    html: '<p id="x">hello</p>',
    cssUrls: ['/assets/apps/transfer-matcher/app.css'],
    jsUrls: ['/assets/apps/transfer-matcher/app.js'],
    fullBleed: true
  });

  assert.equal(mount.innerHTML, '<p id="x">hello</p>');
  assert.equal(sec.style.display, 'block');
  assert.ok(links.indexOf('/assets/apps/transfer-matcher/app.css') >= 0);
  assert.ok(scripts.indexOf('/assets/apps/transfer-matcher/app.js') >= 0);

  // Homepage off-state must not wipe a live merged page pack when __lpLiveCfg is set
  sandbox.__lpLiveCfg = {
    sections: {
      customHtml: {
        on: true,
        html: '<div id="tm-root">pack</div>',
        cssUrls: [],
        jsUrls: []
      }
    }
  };
  sandbox.__SITE_CONFIG__ = {
    sections: { customHtml: { on: false, html: '' } }
  };
  sandbox.lpRefreshCustomHtml();
  assert.match(mount.innerHTML, /tm-root/);
  assert.equal(sec.style.display, 'block');
});

test('seed + register scripts exist for ops', function () {
  assert.ok(fs.existsSync(path.join(root, 'scripts/register-custom-html-app.js')));
  assert.ok(fs.existsSync(path.join(root, 'scripts/seed-transfer-matcher-page.js')));
  const seed = fs.readFileSync(path.join(root, 'scripts/seed-transfer-matcher-page.js'), 'utf8');
  assert.match(seed, /account-transaction-match/);
  assert.match(seed, /status:\s*'published'/);
  assert.match(seed, /transfer-matcher/);
});

test('hybrid page render stores merged config on __lpLiveCfg', function () {
  const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-shared.js'), 'utf8');
  assert.match(demo, /window\.__lpLiveCfg=C;\s*applyCfg\(C\)/);
  ['trade.template.json', 'landing-shell-neutral-v1.template.json'].forEach(function (name) {
    const html = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8')).html;
    assert.ok(html.includes('window.__lpLiveCfg=C; applyCfg(C)'), name);
  });
});

test('Custom HTML editor is responsive with HTML line numbers', function () {
  assert.match(manage, /lp-ch-stack/);
  assert.match(manage, /lp-ch-grid/);
  assert.match(manage, /lp-codeed-gutter/);
  assert.match(manage, /id="ch-html-gutter"/);
  assert.match(manage, /function syncHtmlLines/);
  assert.doesNotMatch(manage, /label class="fld"/);
});
