'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeHex,
  normalizeColorInput,
  sanitizeOverrides,
  applyColorOverridesToCssText,
  applyColorOverridesToConfig,
  clientSource
} = require('../lib/color-overrides');

describe('color-overrides', () => {
  it('normalizes short hex and rgb()', () => {
    assert.equal(normalizeHex('#f0a'), '#ff00aa');
    assert.equal(normalizeColorInput('rgb(255, 0, 170)'), '#ff00aa');
  });

  it('sanitizes override rows', () => {
    const rows = sanitizeOverrides([
      { from: '#FF6A1F', to: '#e91e8c' },
      { from: 'not-a-colour', to: '#000000' },
      { from: '#e91e8c', to: '#e91e8c' }
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].from, '#ff6a1f');
    assert.equal(rows[0].to, '#e91e8c');
  });

  it('rewrites theme CSS text', () => {
    const css = ':root{--pipe:#ff6a1f;--hivis:#ff6a1f}';
    const out = applyColorOverridesToCssText(css, [{ from: '#ff6a1f', to: '#e91e8c' }]);
    assert.match(out, /--pipe:#e91e8c/);
    assert.doesNotMatch(out, /#ff6a1f/i);
  });

  it('remaps config hex but keeps colorOverrides rows', () => {
    const cfg = {
      theme: { pipe: '#1f7bb8', hivis: '#ff6a1f' },
      sections: { hero: { titleColor: '#ff6a1f' } },
      colorOverrides: [{ from: '#ff6a1f', to: '#112233' }]
    };
    const out = applyColorOverridesToConfig(cfg);
    assert.equal(out.theme.hivis, '#112233');
    assert.equal(out.sections.hero.titleColor, '#112233');
    assert.equal(out.colorOverrides[0].from, '#ff6a1f');
    assert.equal(cfg.theme.hivis, '#ff6a1f'); // original untouched
  });

  it('exposes browser helper', () => {
    assert.match(clientSource(), /function __lpApplyColorOverrides/);
  });
});
