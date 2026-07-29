/**
 * Homepage colour styler: 8 Web Culture presets + live CSS var mapping.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const { CULTURE_COLOR_PRESETS } = require('../lib/partner-website/webculture-color-presets');

const home = fs.readFileSync(path.join(ROOT, 'home.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'assets/marketing-home.css'), 'utf8');
const jsSrc = fs.readFileSync(path.join(ROOT, 'assets/marketing-home-colour.js'), 'utf8');

function loadStyler() {
  function el() {
    return {
      style: {},
      hidden: true,
      classList: { toggle: function () {}, add: function () {}, contains: function () { return false; } },
      setAttribute: function () {},
      getAttribute: function () { return null; },
      addEventListener: function () {},
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      appendChild: function () {},
      closest: function () { return null; }
    };
  }
  const sandbox = {
    window: {},
    document: {
      readyState: 'complete',
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      addEventListener: function () {},
      createElement: function () { return el(); },
      head: { appendChild: function () {} },
      documentElement: { style: { setProperty: function () {}, removeProperty: function () {} } },
      body: {
        setAttribute: function () {},
        classList: { toggle: function () {}, contains: function () { return false; } },
        appendChild: function () {}
      }
    },
    sessionStorage: {
      getItem: function () { return null; },
      setItem: function () {}
    }
  };
  sandbox.window = sandbox;
  sandbox.document.defaultView = sandbox;
  vm.runInNewContext(jsSrc, sandbox);
  return sandbox.window.__mktHomeColour;
}

test('homepage embeds the colour styler markup and script', () => {
  assert.match(home, /data-mkt-colour-lab/);
  assert.match(home, /Try colours/);
  assert.match(home, /Pick a colour scheme/);
  assert.match(home, /marketing-home-colour\.js/);
  assert.match(home, /data-mkt-colour-preset="culture"/);
  assert.match(home, /data-mkt-colour-preset="dune"/);
  assert.match(home, /data-mkt-colour-lab-reset/);
});

test('styler exposes the same eight Web Culture presets', () => {
  const api = loadStyler();
  assert.equal(api.presets.length, 8);
  assert.equal(CULTURE_COLOR_PRESETS.length, 8);
  CULTURE_COLOR_PRESETS.forEach(function (src, i) {
    const got = api.presets[i];
    assert.equal(got.id, src.id, src.id + ' id');
    assert.equal(got.name, src.name, src.id + ' name');
    assert.equal(got.primary, src.primary, src.id + ' primary');
    assert.equal(got.ink, src.ink, src.id + ' ink');
    assert.equal(got.bg, src.bg, src.id + ' bg');
    assert.equal(got.surface, src.surface, src.id + ' surface');
    assert.equal(got.muted, src.muted, src.id + ' muted');
    assert.equal(got.glow, src.glow, src.id + ' glow');
  });
});

test('styler adds Neon Pink and Electric Blue frontend themes', () => {
  const api = loadStyler();
  assert.ok(Array.isArray(api.extraPresets));
  assert.ok(Array.isArray(api.allPresets));
  assert.equal(api.allPresets.length, 10);
  const neon = api.extraPresets.find((p) => p.id === 'neon-pink');
  const blue = api.extraPresets.find((p) => p.id === 'electric-blue');
  assert.ok(neon && neon.primary);
  assert.ok(blue && blue.primary);
  assert.match(neon.primary, /^#/i);
  assert.match(blue.primary, /^#/i);
});

test('palette mapping drives navy/cream/orange homepage tokens', () => {
  const api = loadStyler();
  const rivet = api.presets.find(function (p) { return p.id === 'rivet'; });
  const vars = api.homepageVarsFromPalette(rivet);
  assert.equal(vars['--navy'], rivet.ink);
  assert.equal(vars['--cream'], rivet.bg);
  assert.equal(vars['--cream-warm'], rivet.surface);
  assert.equal(vars['--orange'], rivet.primary);
  assert.equal(vars['--on-dark'], rivet.bg);
  assert.equal(vars['--gold'], rivet.glow);
  assert.match(vars['--navy-deep'], /^#/);
  assert.match(vars['--orange-hover'], /^#/);
  assert.notEqual(vars['--orange-hover'], rivet.primary);
});

test('homepage CSS is themeable via design tokens', () => {
  assert.match(css, /\.connected\s*\{[^}]*background:\s*var\(--navy\)/s);
  assert.match(css, /--lp-logo-ink:\s*var\(--on-dark\)/);
  assert.match(css, /--lp-logo-accent:\s*var\(--orange\)/);
  assert.match(css, /\.mkt-colour-lab__fab/);
  assert.match(css, /\.mkt-colour-lab__swatch/);
});

test('shared colour-lab CSS is extractable for marketplace feature pages', () => {
  const labCss = fs.readFileSync(path.join(ROOT, 'assets/marketing-colour-lab.css'), 'utf8');
  assert.match(labCss, /\.mkt-colour-lab__fab/);
  assert.match(labCss, /\.mkt-colour-lab__swatch/);
  assert.match(labCss, /\.mkt-colour-lab__panel/);
});
