/**
 * Visitor accessibility widget: marketing mobile hide, no themes on homepage,
 * preference features, and WCAG 2.2 AA chrome patterns.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const jsSrc = fs.readFileSync(path.join(ROOT, 'assets/lp-visitor-accessibility.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(ROOT, 'assets/lp-visitor-accessibility.css'), 'utf8');
const logoSrc = fs.readFileSync(path.join(ROOT, 'assets/lp-logo.js'), 'utf8');
const themesCss = fs.readFileSync(path.join(ROOT, 'assets/lp-visitor-themes.css'), 'utf8');

function el(tag) {
  const attrs = Object.create(null);
  const children = [];
  const listeners = Object.create(null);
  const node = {
    tagName: String(tag).toUpperCase(),
    id: '',
    className: '',
    hidden: false,
    style: { fontSize: '' },
    dataset: {},
    parentNode: null,
    get parentElement() { return node.parentNode; },
    isConnected: false,
    innerHTML: '',
    textContent: '',
    childNodes: children,
    setAttribute: function (k, v) {
      attrs[k] = String(v);
      if (k === 'id') node.id = String(v);
      if (k === 'hidden') node.hidden = true;
      if (k === 'class') node.className = String(v);
      if (k.indexOf('data-') === 0) {
        const camel = k.slice(5).replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
        node.dataset[camel] = String(v);
      }
    },
    getAttribute: function (k) {
      if (k === 'id') return node.id || null;
      if (k === 'hidden') return node.hidden ? '' : null;
      return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null;
    },
    removeAttribute: function (k) {
      delete attrs[k];
      if (k === 'hidden') node.hidden = false;
      if (k.indexOf('data-') === 0) {
        const camel = k.slice(5).replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
        delete node.dataset[camel];
      }
    },
    appendChild: function (child) {
      child.parentNode = node;
      child.isConnected = true;
      children.push(child);
      return child;
    },
    removeChild: function (child) {
      const i = children.indexOf(child);
      if (i >= 0) children.splice(i, 1);
      child.parentNode = null;
      child.isConnected = false;
      return child;
    },
    contains: function (other) {
      if (other === node) return true;
      for (let i = 0; i < children.length; i++) {
        if (children[i] === other || (children[i].contains && children[i].contains(other))) return true;
      }
      // Approximate: panel/trigger are parsed into flat query map, not real tree from innerHTML
      return false;
    },
    addEventListener: function (type, fn, opts) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push({ fn: fn, opts: opts });
      if (opts && opts.signal) {
        opts.signal.addEventListener('abort', function () {
          listeners[type] = (listeners[type] || []).filter(function (x) { return x.fn !== fn; });
        });
      }
    },
    focus: function () { node._focused = true; document.activeElement = node; },
    click: function () {
      (listeners.click || []).forEach(function (x) { x.fn({ type: 'click', target: node, preventDefault: function () {} }); });
    },
    querySelector: function (sel) { return queryOne(node, sel); },
    querySelectorAll: function (sel) { return queryAll(node, sel); },
    _attrs: attrs,
    _listeners: listeners,
    _children: children
  };
  return node;
}

function makeButton(attrStr, inner) {
  const btn = el('button');
  btn.type = 'button';
  [
    ['id', /id="([^"]+)"/],
    ['class', /class="([^"]+)"/],
    ['data-val', /data-val="([^"]+)"/],
    ['aria-pressed', /aria-pressed="([^"]+)"/],
    ['aria-label', /aria-label="([^"]+)"/],
    ['aria-expanded', /aria-expanded="([^"]+)"/],
    ['aria-controls', /aria-controls="([^"]+)"/],
    ['aria-haspopup', /aria-haspopup="([^"]+)"/],
    ['title', /title="([^"]+)"/]
  ].forEach(function (pair) {
    const m = pair[1].exec(attrStr);
    if (m) btn.setAttribute(pair[0], m[1]);
  });
  btn.textContent = String(inner || '').replace(/<[^>]+>/g, '').trim();
  return btn;
}

function parseButtons(html, parent) {
  // Trigger lives outside the panel — capture the full opening tag attrs
  const triggerM = /<button\b([^>]*\bid="lpa-trigger"[^>]*)>([\s\S]*?)<\/button>/i.exec(html);
  if (triggerM) parent.appendChild(makeButton(triggerM[1], triggerM[2]));

  const panel = el('div');
  panel.setAttribute('id', 'lpa-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'lpa-panel-title');
  panel.setAttribute('aria-modal', 'true');
  panel.hidden = true;
  panel.setAttribute('hidden', '');

  const title = el('h2');
  title.setAttribute('id', 'lpa-panel-title');
  title.textContent = 'Viewing Preferences';
  panel.appendChild(title);

  const closeM = /<button\b([^>]*\bid="lpa-close"[^>]*)>([\s\S]*?)<\/button>/i.exec(html);
  if (closeM) panel.appendChild(makeButton(closeM[1], closeM[2]));

  const groupRe = /data-group="([^"]+)"/g;
  let gm;
  while ((gm = groupRe.exec(html))) {
    const group = gm[1];
    const start = gm.index;
    const next = html.indexOf('data-group="', start + 1);
    const end = next === -1 ? html.indexOf('id="lpa-reset"', start) : next;
    const slice = html.slice(start, end === -1 ? html.length : end);
    const row = el('div');
    row.setAttribute('data-group', group);
    row.setAttribute('class', group === 'colorScheme' ? 'lpa-scheme-grid' : 'lpa-row');
    const btnRe = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
    let bm;
    while ((bm = btnRe.exec(slice))) {
      row.appendChild(makeButton(bm[1], bm[2]));
    }
    if (row._children.length) panel.appendChild(row);
  }

  const resetM = /<button\b([^>]*\bid="lpa-reset"[^>]*)>([\s\S]*?)<\/button>/i.exec(html);
  if (resetM) panel.appendChild(makeButton(resetM[1], resetM[2]));

  parent.appendChild(panel);
  return parent;
}

function queryOne(root, sel) {
  const all = queryAll(root, sel);
  return all[0] || null;
}

function queryAll(root, sel) {
  const out = [];
  function walk(n) {
    if (!n) return;
    if (match(n, sel)) out.push(n);
    (n._children || []).forEach(walk);
  }
  walk(root);
  // Also scan flat registry for id lookups from document
  if (root._byId) {
    Object.keys(root._byId).forEach(function (id) {
      if (match(root._byId[id], sel) && out.indexOf(root._byId[id]) < 0) out.push(root._byId[id]);
    });
  }
  return out;
}

function match(n, sel) {
  if (!n || !sel) return false;
  if (sel.charAt(0) === '#') return n.id === sel.slice(1);
  if (sel.indexOf('[data-group]') === 0) return !!n.getAttribute('data-group');
  if (sel.indexOf('[data-group=') === 0) {
    const g = /\[data-group="([^"]+)"\]/.exec(sel);
    return g && n.getAttribute('data-group') === g[1];
  }
  if (sel === 'button') return n.tagName === 'BUTTON';
  if (sel === '.lpa-opt') return (n.className || '').split(/\s+/).indexOf('lpa-opt') >= 0;
  if (sel === '.lpa-scheme') return (n.className || '').split(/\s+/).indexOf('lpa-scheme') >= 0;
  if (sel === '.lpa-opt, .lpa-scheme') return match(n, '.lpa-opt') || match(n, '.lpa-scheme');
  if (sel.indexOf('.lpa-opt[aria-pressed="true"]') === 0) {
    return match(n, '.lpa-opt') && n.getAttribute('aria-pressed') === 'true';
  }
  if (sel === 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') {
    return n.tagName === 'BUTTON';
  }
  if (sel.indexOf('[') === 0) {
    const m = /\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]/.exec(sel);
    if (!m) return false;
    const val = n.getAttribute(m[1]);
    if (m[2] == null) return val != null;
    return val === m[2];
  }
  return false;
}

let document;
let storage;
let mediaMatches;

function makeSandbox(cfg, opts) {
  opts = opts || {};
  mediaMatches = !!opts.mobile;
  storage = Object.create(null);
  const html = el('html');
  html.dataset = {};
  const body = el('body');
  const head = el('head');
  body.parentNode = html;
  head.parentNode = html;
  html.appendChild(head);
  html.appendChild(body);

  const byId = Object.create(null);
  document = {
    readyState: 'complete',
    documentElement: html,
    body: body,
    head: head,
    activeElement: body,
    _byId: byId,
    getElementById: function (id) { return byId[id] || null; },
    querySelector: function (sel) { return queryOne(html, sel); },
    querySelectorAll: function (sel) { return queryAll(html, sel); },
    createElement: function (tag) {
      const node = el(tag);
      const origSet = node.setAttribute;
      node.setAttribute = function (k, v) {
        origSet(k, v);
        if (k === 'id' && v) byId[v] = node;
      };
      const desc = Object.getOwnPropertyDescriptor(node, 'innerHTML');
      Object.defineProperty(node, 'innerHTML', {
        configurable: true,
        get: function () { return node._html || ''; },
        set: function (htmlStr) {
          node._html = String(htmlStr);
          // Clear previous synthetic children except keeping structure rebuild
          node._children.length = 0;
          parseButtons(String(htmlStr), node);
          node._children.forEach(function (c) {
            if (c.id) byId[c.id] = c;
            (c._children || []).forEach(function (gc) {
              if (gc.id) byId[gc.id] = gc;
            });
          });
        }
      });
      return node;
    },
    addEventListener: function (type, fn, opts) {
      if (!document._listeners) document._listeners = Object.create(null);
      if (!document._listeners[type]) document._listeners[type] = [];
      document._listeners[type].push({ fn: fn, opts: opts });
      if (opts && opts.signal) {
        opts.signal.addEventListener('abort', function () {
          document._listeners[type] = (document._listeners[type] || []).filter(function (x) { return x.fn !== fn; });
        });
      }
    },
    dispatchKey: function (key, shiftKey) {
      const ev = {
        key: key,
        shiftKey: !!shiftKey,
        preventDefault: function () { ev.defaultPrevented = true; },
        defaultPrevented: false
      };
      (document._listeners && document._listeners.keydown || []).forEach(function (x) { x.fn(ev); });
      return ev;
    }
  };

  // Fix body.appendChild to register ids
  const origAppend = body.appendChild;
  body.appendChild = function (child) {
    origAppend(child);
    if (child.id) byId[child.id] = child;
    function reg(n) {
      if (n.id) byId[n.id] = n;
      (n._children || []).forEach(reg);
    }
    reg(child);
    return child;
  };
  const origRemove = body.removeChild;
  body.removeChild = function (child) {
    function unreg(n) {
      if (n.id && byId[n.id] === n) delete byId[n.id];
      (n._children || []).forEach(unreg);
    }
    unreg(child);
    return origRemove(child);
  };

  const sandbox = {
    window: null,
    document: document,
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
      setItem: function (k, v) { storage[k] = String(v); },
      removeItem: function (k) { delete storage[k]; }
    },
    matchMedia: function (q) {
      const mobile = /\(max-width:\s*(\d+)px\)/.exec(q);
      const matches = mobile ? mediaMatches : false;
      return {
        matches: matches,
        media: q,
        addEventListener: function () {},
        addListener: function () {},
        removeEventListener: function () {},
        removeListener: function () {}
      };
    },
    AbortController: global.AbortController,
    __LP_VISITOR_A11Y__: cfg,
    LPVisitorSchemes: {
      apply: function (scheme) { sandbox._lastScheme = scheme; },
      setScheme: function (scheme) { sandbox._lastScheme = scheme; },
      readStorage: function () { return null; },
      boot: function () {},
      SCHEMES: {
        brand: { name: 'Brand', emoji: '✦' },
        rose: { name: 'Rose', emoji: '🌸' },
        steel: { name: 'Steel', emoji: '🔩' },
        seasonal: { name: 'Seasonal', emoji: '📅' }
      },
      STORAGE_KEY: 'leadpages_visitor_scheme'
    },
    console: console
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(jsSrc, sandbox);
  return sandbox;
}

test('marketing boot disables themes/schemes and hides on mobile', () => {
  assert.match(logoSrc, /hideOnMobile:\s*true/);
  assert.match(logoSrc, /mobileMaxWidth:\s*960/);
  assert.match(logoSrc, /allowColorSchemes:\s*false/);
  assert.match(logoSrc, /allowThemeToggle:\s*false/);
});

test('CSS hides data-hide-mobile root under 960px', () => {
  assert.match(cssSrc, /data-hide-mobile="true"/);
  assert.match(cssSrc, /@media \(max-width: 960px\)/);
  assert.match(cssSrc, /display:\s*none\s*!important/);
});

test('CSS meets WCAG 2.2 target size (min 44px) and focus-visible', () => {
  assert.match(cssSrc, /#lpa-trigger[\s\S]*min-height:\s*44px/);
  assert.match(cssSrc, /\.lpa-opt[\s\S]*min-height:\s*44px/);
  assert.match(cssSrc, /#lpa-close[\s\S]*min-height:\s*44px/);
  assert.match(cssSrc, /#lpa-reset[\s\S]*min-height:\s*44px/);
  assert.match(cssSrc, /#lpa-trigger:focus-visible/);
  assert.match(cssSrc, /\.lpa-opt:focus-visible/);
  assert.match(cssSrc, /#lpa-close:focus-visible/);
  assert.match(cssSrc, /\.lpa-scheme:focus-visible/);
});

test('theme CSS implements all preference feature effects', () => {
  assert.match(themesCss, /data-lp-visitor-text="large"/);
  assert.match(themesCss, /data-lp-visitor-text="larger"/);
  assert.match(themesCss, /data-lp-visitor-contrast="high"/);
  assert.match(themesCss, /data-lp-visitor-motion="reduced"/);
  assert.match(themesCss, /data-lp-visitor-links="highlight"/);
  assert.match(themesCss, /data-lp-visitor-spacing="comfortable"/);
});

test('mobile viewport with hideOnMobile does not render the widget', () => {
  const sb = makeSandbox({
    enabled: true,
    hideOnMobile: true,
    mobileMaxWidth: 960,
    defaults: { allowThemeToggle: false, allowColorSchemes: false }
  }, { mobile: true });
  assert.equal(sb.LPVisitorAccessibility.hideOnMobile(), true);
  assert.equal(sb.LPVisitorAccessibility.isMobileViewport(), true);
  assert.equal(document.getElementById('lpa-root'), null);
});

test('desktop marketing config renders widget without Theme or Colour scheme', () => {
  const sb = makeSandbox({
    enabled: true,
    hideOnMobile: true,
    mobileMaxWidth: 960,
    position: 'bottom-right',
    defaults: { allowThemeToggle: false, allowColorSchemes: false }
  }, { mobile: false });
  const root = document.getElementById('lpa-root');
  assert.ok(root, 'lpa-root present on desktop');
  assert.equal(root.getAttribute('data-hide-mobile'), 'true');
  assert.equal(sb.LPVisitorAccessibility.allowThemeToggle(), false);
  assert.equal(sb.LPVisitorAccessibility.allowColorSchemes(), false);
  const html = root._html || '';
  assert.doesNotMatch(html, />Theme</);
  assert.doesNotMatch(html, /Colour scheme/);
  assert.match(html, /Text size/);
  assert.match(html, /Contrast/);
  assert.match(html, /Motion/);
  assert.match(html, /Links/);
  assert.match(html, /Spacing/);
  assert.ok(document.getElementById('lpa-trigger'));
  assert.ok(document.getElementById('lpa-panel'));
  assert.ok(document.getElementById('lpa-close'));
});

test('desktop with themes enabled still shows Theme and Colour scheme', () => {
  const sb = makeSandbox({
    enabled: true,
    defaults: { allowThemeToggle: true, allowColorSchemes: true }
  }, { mobile: false });
  const root = document.getElementById('lpa-root');
  assert.ok(root);
  assert.equal(sb.LPVisitorAccessibility.allowThemeToggle(), true);
  assert.match(root._html, /Theme/);
  assert.match(root._html, /Colour scheme/);
});

test('every preference feature applies html data attributes', () => {
  const sb = makeSandbox({
    enabled: true,
    defaults: { allowThemeToggle: false, allowColorSchemes: false }
  }, { mobile: false });
  const api = sb.LPVisitorAccessibility;
  const htmlEl = document.documentElement;

  api.apply({
    textSize: 'large',
    contrast: 'high',
    theme: 'dark',
    motion: 'reduced',
    links: 'highlight',
    spacing: 'comfortable',
    colorScheme: 'rose'
  });
  assert.equal(htmlEl.dataset.lpVisitorText, 'large');
  assert.equal(htmlEl.dataset.lpVisitorContrast, 'high');
  assert.equal(htmlEl.dataset.lpVisitorTheme, 'light', 'theme forced light when toggle disabled');
  assert.equal(htmlEl.dataset.lpVisitorMotion, 'reduced');
  assert.equal(htmlEl.dataset.lpVisitorLinks, 'highlight');
  assert.equal(htmlEl.dataset.lpVisitorSpacing, 'comfortable');
  assert.equal(sb._lastScheme, 'brand', 'schemes forced to brand when disabled');
  assert.equal(document.body.style.fontSize, '1.1875rem');

  api.apply({
    textSize: 'larger',
    contrast: 'standard',
    theme: 'light',
    motion: 'standard',
    links: 'standard',
    spacing: 'standard',
    colorScheme: 'brand'
  });
  assert.equal(htmlEl.dataset.lpVisitorText, 'larger');
  assert.equal(document.body.style.fontSize, '1.3125rem');
  assert.equal(htmlEl.dataset.lpVisitorContrast, 'standard');
  assert.equal(htmlEl.dataset.lpVisitorMotion, 'standard');
  assert.equal(htmlEl.dataset.lpVisitorLinks, 'standard');
  assert.equal(htmlEl.dataset.lpVisitorSpacing, 'standard');
});

test('panel dialog exposes WCAG dialog semantics and Escape closes', () => {
  makeSandbox({
    enabled: true,
    defaults: { allowThemeToggle: false, allowColorSchemes: false }
  }, { mobile: false });
  const trigger = document.getElementById('lpa-trigger');
  const root = document.getElementById('lpa-root');
  const panel = root.querySelector('#lpa-panel') || document.getElementById('lpa-panel');
  assert.ok(panel, 'panel exists');
  assert.equal(panel.getAttribute('role'), 'dialog');
  assert.equal(panel.getAttribute('aria-modal'), 'true');
  assert.equal(panel.getAttribute('aria-labelledby'), 'lpa-panel-title');
  assert.match(root._html, /role="dialog"/);
  assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(trigger.getAttribute('aria-controls'), 'lpa-panel');
  assert.match(trigger.getAttribute('aria-label') || '', /accessibility/i);

  trigger.click();
  assert.equal(root.getAttribute('data-open'), 'true');
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(panel.hidden, false);

  document.dispatchKey('Escape');
  assert.equal(root.getAttribute('data-open'), 'false');
  assert.equal(panel.hidden, true);
});

test('clicking preference buttons updates pressed state and storage', () => {
  const sb = makeSandbox({
    enabled: true,
    defaults: { allowThemeToggle: false, allowColorSchemes: false }
  }, { mobile: false });
  const root = document.getElementById('lpa-root');
  const panel = document.getElementById('lpa-panel');
  const motionRow = panel.querySelector('[data-group="motion"]');
  assert.ok(motionRow);
  const reduced = motionRow.querySelectorAll('.lpa-opt').find
    ? Array.from(motionRow.querySelectorAll('.lpa-opt')).find(function (b) { return b.getAttribute('data-val') === 'reduced'; })
    : motionRow._children.find(function (b) { return b.getAttribute('data-val') === 'reduced'; });
  assert.ok(reduced);
  reduced.click();
  assert.equal(document.documentElement.dataset.lpVisitorMotion, 'reduced');
  assert.equal(reduced.getAttribute('aria-pressed'), 'true');
  const stored = JSON.parse(sb.localStorage.getItem(sb.LPVisitorAccessibility.STORAGE_KEY));
  assert.equal(stored.motion, 'reduced');
});

test('text size buttons include standard/large/larger (no dead small control)', () => {
  makeSandbox({
    enabled: true,
    defaults: { allowThemeToggle: false, allowColorSchemes: false }
  }, { mobile: false });
  const html = document.getElementById('lpa-root')._html;
  assert.match(html, /data-val="standard"/);
  assert.match(html, /data-val="large"/);
  assert.match(html, /data-val="larger"/);
  assert.doesNotMatch(html, /data-val="small"/);
});

test('mapTextSize normalises values', () => {
  const sb = makeSandbox({ enabled: false }, { mobile: false });
  assert.equal(sb.LPVisitorAccessibility.mapTextSize('large'), 'large');
  assert.equal(sb.LPVisitorAccessibility.mapTextSize('larger'), 'larger');
  assert.equal(sb.LPVisitorAccessibility.mapTextSize('small'), 'standard');
  assert.equal(sb.LPVisitorAccessibility.mapTextSize('nope'), 'standard');
});

test('click-through: every marketing preference control works end-to-end', () => {
  const sb = makeSandbox({
    enabled: true,
    hideOnMobile: true,
    defaults: { allowThemeToggle: false, allowColorSchemes: false }
  }, { mobile: false });
  const panel = document.getElementById('lpa-panel');
  const htmlEl = document.documentElement;

  function clickGroup(group, val) {
    const row = panel.querySelector('[data-group="' + group + '"]');
    assert.ok(row, group + ' row');
    const btn = row._children.find(function (b) { return b.getAttribute('data-val') === val; });
    assert.ok(btn, group + '=' + val);
    btn.click();
    assert.equal(btn.getAttribute('aria-pressed'), 'true');
  }

  clickGroup('textSize', 'larger');
  assert.equal(htmlEl.dataset.lpVisitorText, 'larger');
  assert.equal(document.body.style.fontSize, '1.3125rem');

  clickGroup('contrast', 'high');
  assert.equal(htmlEl.dataset.lpVisitorContrast, 'high');

  clickGroup('motion', 'reduced');
  assert.equal(htmlEl.dataset.lpVisitorMotion, 'reduced');

  clickGroup('links', 'highlight');
  assert.equal(htmlEl.dataset.lpVisitorLinks, 'highlight');

  clickGroup('spacing', 'comfortable');
  assert.equal(htmlEl.dataset.lpVisitorSpacing, 'comfortable');

  document.getElementById('lpa-reset').click();
  assert.equal(htmlEl.dataset.lpVisitorText, 'standard');
  assert.equal(htmlEl.dataset.lpVisitorContrast, 'standard');
  assert.equal(htmlEl.dataset.lpVisitorMotion, 'standard');
  assert.equal(htmlEl.dataset.lpVisitorLinks, 'standard');
  assert.equal(htmlEl.dataset.lpVisitorSpacing, 'standard');
  assert.equal(sb.localStorage.getItem(sb.LPVisitorAccessibility.STORAGE_KEY), null);
});
