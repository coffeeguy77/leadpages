'use strict';

/**
 * "New look" back office (opt-in): one UI kit (assets/lp-ui.css) on every admin page,
 * side/top menu shell in the editor, theme tokens only — and nothing changes until the
 * user turns it on in Appearance.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const kit = read('assets/lp-ui.css');

const ADMIN_PAGES = [
  'manage', 'command', 'partner', 'partner-onboarding', 'partners-admin', 'marketplace-admin', 'apps-admin',
  'brain-admin', 'billing', 'billing-admin', 'orders', 'bookings', 'messages', 'manage-domains', 'domain-finder',
  'marketing-hub', 'theme-studio', 'theme-studio-v2', 'lead-notify-style-admin', 'ai-composer', 'layout-composer',
  'settings/integrations/google-ads', 'settings/integrations/google-analytics', 'settings/integrations/google-business',
  'settings/integrations/search-console', 'settings/integrations/tag-manager'
];

test('every admin page loads the one UI kit', () => {
  for (const p of ADMIN_PAGES) {
    const html = read(p + '.html');
    assert.match(html, /\/assets\/lp-ui\.css\?v=\d+/, p + ' kit');
    if (p !== 'manage') assert.match(html, /\/assets\/lp-ui-boot\.js\?v=\d+/, p + ' boot');
  }
});

/** Split a selector list on top-level commas only. */
function splitTop(sel) {
  const out = []; let depth = 0; let cur = '';
  for (const ch of sel) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

test('the kit is opt-in: every rule sits under the new-look switch', () => {
  const body = kit.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = body.match(/(^|\})\s*([^{}@]+)\{/g) || [];
  for (const raw of selectors) {
    const sel = raw.replace(/^\}?\s*/, '').replace(/\{$/, '').trim();
    if (!sel || /^(from|to|\d+%)$/.test(sel)) continue;
    for (const part of splitTop(sel)) {
      const s = part.trim();
      // Shell parts are hidden by default (they only exist once the shell mounts).
      if (/^\.lpui-/.test(s)) continue;
      assert.match(s, /data-lp-ui="v2"/, 'unscoped selector: ' + s);
    }
  }
});

test('the kit takes colours from theme tokens only', () => {
  const tokens = kit.slice(kit.indexOf('html[data-lp-ui="v2"] {'), kit.indexOf('/* ───────────────────────── Base'));
  // Colours outside the token block are tokens, color-mix of tokens, or transparent.
  const rest = kit.replace(tokens, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const hex = rest.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.deepEqual(hex.filter((h) => !/^#000$/.test(h)), [], 'hard-coded colours outside tokens');
  // Older page palettes follow the theme.
  for (const k of ['--paper', '--ink', '--line', '--rose', '--gum', '--surface', '--brand']) {
    assert.match(tokens, new RegExp(k + ':\\s*var\\(--ui-'), k);
  }
});

test('boot script sets the switch from the saved Appearance choice', () => {
  const src = read('assets/lp-ui-boot.js');
  const run = (prefs) => {
    const attrs = {}; const style = {};
    const doc = {
      documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => attrs[k] || null, style },
      head: { appendChild() {} }, querySelector: () => null, getElementById: () => null,
      createElement: () => ({}), currentScript: null, getElementsByTagName: () => [{}]
    };
    const ls = { getItem: () => (prefs ? JSON.stringify(prefs) : null) };
    vm.runInNewContext(src, { document: doc, localStorage: ls, window: {}, JSON });
    return attrs;
  };
  assert.equal(run(null)['data-lp-ui'], 'classic');
  assert.equal(run(null)['data-theme'], undefined);
  const v2 = run({ ui: 'v2', nav: 'top', theme: 'studio-dark' });
  assert.equal(v2['data-lp-ui'], 'v2');
  assert.equal(v2['data-lp-nav'], 'top');
  assert.equal(v2['data-theme'], 'studio-dark');
});

test('Appearance has the Interface switch and Studio themes', () => {
  const manage = read('manage.html');
  assert.match(manage, /data-aa-ui/);
  assert.match(manage, /data-aa-nav/);
  const themes = read('assets/lp-themes.css');
  assert.match(themes, /\[data-theme="studio-light"\]/);
  assert.match(themes, /\[data-theme="studio-dark"\]/);
  const ap = read('assets/lp-workspace-appearance.js');
  assert.match(ap, /ui:\s*'classic'/);
});

test('Bookings desk has no hard-coded white cards (dark themes)', () => {
  const css = read('assets/bk-fleet-admin.js').split('].join')[0];
  assert.doesNotMatch(css, /background:#fff[;}]/);
  const bk = read('bookings.html');
  const style = bk.slice(bk.indexOf('<style>'), bk.indexOf('</style>'));
  assert.doesNotMatch(style, /background:#fff[;}]/);
});
