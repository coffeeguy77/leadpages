'use strict';

/**
 * Try colours on customer sites (Nov 2026): the leadpages.com.au colour studio replaces the old
 * visitor colour schemes / site themes; the accessibility button only does accessibility.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('same ten schemes as the leadpages.com.au Try colours', () => {
  const mkt = read('assets/marketing-home-colour.js');
  const site = read('assets/lp-try-colours.js');
  const ids = (s) => (s.match(/id: '([a-z-]+)', name:/g) || s.match(/id: '([a-z-]+)',\n\s+name:/g) || []).length;
  ['culture', 'basalt', 'rivet', 'tarmac', 'petal', 'willow', 'orchid', 'dune', 'neon-pink', 'electric-blue'].forEach((id) => {
    assert.match(mkt, new RegExp("id: '" + id + "'"));
    assert.match(site, new RegExp("id: '" + id + "'"));
  });
  // Same colours as the marketing site.
  ['#C5E13F', '#0B2114', '#D97706', '#F97316', '#14B8A6', '#E8A0A8', '#8FAE6B', '#B28BB8', '#C47A4A', '#FF4DA6', '#3B9EFF'].forEach((h) => assert.ok(site.includes(h), h));
  void ids;
});

test('renderer: Try colours only when on; old schemes no longer loaded; accessibility-only widget', () => {
  const r = read('api/render.js');
  assert.match(r, /const t = \(cfg && cfg\.sections && cfg\.sections\.tryColours\) \|\| \(cfg && cfg\.tryColours\) \|\| \{\};/);
  assert.match(r, /if \(!t\.on\) return html;/);
  assert.match(r, /html = injectFormChallenge\(html, cfg\);\n    html = injectTryColours\(html, cfg\);/);
  assert.doesNotMatch(r, /lp-visitor-schemes\.(css|js)/);
  assert.match(r, /defaults: Object\.assign\(\{\}, va, \{ siteTheme: 'classic-light', colorScheme: 'brand', allowColorSchemes: false, allowThemeToggle: false \}\)/);
});

test('templates no longer apply the old site themes or colour schemes', () => {
  ['trade.template.json', 'broker.template.json', 'brokerapp.template.json', 'landing-shell-neutral-v1.template.json'].forEach((f) => {
    const s = read(f);
    assert.doesNotMatch(s, /setAttribute\('data-lp-site-theme', st\)/, f);
    assert.doesNotMatch(s, /setAttribute\('data-lp-visitor-scheme', scheme\)/, f);
  });
});

test('editor: Try Colours + Accessibility in Business Identity; LeadPages schemes in Branding', () => {
  const m = read('manage.html');
  assert.match(m, /\['Business Identity & Hero Area',\['branding','logo','tryColours','lpAccessibility',/);
  assert.match(m, /\['tryColours','Try Colours'\],\['lpAccessibility','Accessibility'\]\]/);
  assert.match(m, /\} else if\(sub==='tryColours'\)\{/);
  assert.match(m, /\} else if\(sub==='lpAccessibility'\)\{/);
  assert.match(m, /id="lp-scheme-library"/);
  assert.match(m, /function lpTrySchemeTheme\(row\)/);
  assert.doesNotMatch(m, /<h2 style="margin:0 0 4px">Default site theme<\/h2>/);
  assert.match(m, /const OFF_BY_DEFAULT_SECTIONS=\['tryColours',/);
});

test('picker restores the site colours and keeps text readable on light schemes', () => {
  const s = read('assets/lp-try-colours.js');
  assert.match(s, /function restoreInline\(\)/);
  assert.match(s, /sessionStorage\.setItem\(KEY, p\.id\)/);
  assert.match(s, /var lightPrimary = contrast\(p\.primary, '#FFFFFF'\) < 2\.6;/);
  const css = read('assets/lp-try-colours.css');
  assert.match(css, /prefers-color-scheme:dark/);
  assert.match(css, /body:has\(#lpa-root\) \.lptc-fab/);
});

test('dark bands use a deep scheme colour; background-color is never treated as text', () => {
  const s = read('assets/lp-try-colours.js');
  assert.match(s, /var deep = mix\(p\.primary, p\.ink, 0\.6\);/);
  assert.match(s, /if \(role === 'dark'\) return prop === 'color' \? r\.dark : r\.deep;/);
  assert.match(s, /var asText = prop === 'color' \|\| \(isVar && /);
});

test('theme-coloured SVG logo (header + footer)', () => {
  const js = read('assets/lp-layouts.js');
  assert.match(js, /var hu = L\.themed === true && isSvg\(L\.imageUrl\) \? L\.imageUrl : '';/);
  assert.match(js, /replace\(\/<script\[\\s\\S\]\*\?<\\\/script>\/gi, ''\)/);
  assert.match(read('assets/lp-layouts.css'), /footer\.site \.lpl-logo-svg-f\{--lpl-logo-ink:#ffffff\}/);
});
