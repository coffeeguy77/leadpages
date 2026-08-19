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

  it('collects unique hex colours from config', () => {
    const {
      collectHexColorsFromConfig
    } = require('../lib/color-overrides');
    const cols = collectHexColorsFromConfig({
      theme: { pipe: '#1f7bb8', hivis: '#FF6A1F' },
      sections: { hero: { titleColor: '#ff6a1f', bg: '#eef2f6' } },
      colorOverrides: [{ from: '#111111', to: '#222222' }]
    });
    assert.ok(cols.includes('#1f7bb8'));
    assert.ok(cols.includes('#ff6a1f'));
    assert.ok(cols.includes('#eef2f6'));
    assert.ok(!cols.includes('#111111'));
  });

  it('bakes overrides permanently into config hex values', () => {
    const {
      bakeColorOverridesIntoConfig
    } = require('../lib/color-overrides');
    const cfg = {
      theme: { pipe: '#1f7bb8', hivis: '#e91e8c' },
      sections: {
        hero: { titleColor: '#e91e8c', btnBg: '#1f7bb8' },
        faq: { headingColor: '#e91e8c' }
      },
      colorOverrides: [
        { id: 'a', from: '#e91e8c', to: '#1f5c3a' },
        { id: 'b', from: '#00ff00', to: '#0000ff' }
      ]
    };
    const out = bakeColorOverridesIntoConfig(cfg);
    assert.equal(out.config.theme.hivis, '#1f5c3a');
    assert.equal(out.config.sections.hero.titleColor, '#1f5c3a');
    assert.equal(out.config.sections.faq.headingColor, '#1f5c3a');
    assert.equal(out.config.sections.hero.btnBg, '#1f7bb8');
    assert.equal(out.baked.length, 2);
    assert.equal(out.config.colorOverrides.length, 0);
    // original untouched
    assert.equal(cfg.theme.hivis, '#e91e8c');
  });
});
