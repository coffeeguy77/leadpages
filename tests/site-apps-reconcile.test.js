'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Mirrors manage.html _secHasUserContent — protects built sections from marketplace disable.
 */
function sectionHasUserContent(cfg, key) {
  const s = (cfg && cfg.sections && cfg.sections[key]) || {};
  if (key === 'trustBar') {
    const badges = s.badges;
    if (!Array.isArray(badges) || !badges.length) return false;
    const defaults = ['Licensed', 'Insured', 'Fixed Pricing', 'Work Guaranteed', '5 Star Rated', 'Local Business'];
    return badges.some(function (b) {
      if (!b || b.on === false) return false;
      const lab = (b.label != null ? String(b.label).trim() : '');
      if (lab && defaults.indexOf(lab) < 0) return true;
      if (b.linkAction && b.linkAction !== 'none') return true;
      if (b.image && String(b.image).trim()) return true;
      return false;
    });
  }
  if (key === 'scrollingSponsorBanner') {
    const inst = s.instances;
    if (!Array.isArray(inst) || !inst.length) return false;
    return inst.some(function (row) {
      if (!row || row.enabled === false) return false;
      const tiles = row.tiles;
      if (!Array.isArray(tiles) || !tiles.length) return false;
      return tiles.some(function (t) {
        return t && t.enabled !== false && ((t.image && String(t.image).trim()) || (t.name && String(t.name).trim()));
      });
    });
  }
  return false;
}

test('sectionHasUserContent detects custom trust bar badge with link', function () {
  const cfg = {
    sections: {
      trustBar: {
        badges: [{ on: true, label: 'Visit facebook for latest news', linkAction: 'url', linkUrl: 'https://example.com' }]
      }
    }
  };
  assert.equal(sectionHasUserContent(cfg, 'trustBar'), true);
});

test('sectionHasUserContent ignores default trust bar badges only', function () {
  const cfg = {
    sections: {
      trustBar: {
        badges: [{ on: true, label: 'Licensed' }, { on: true, label: 'Insured' }]
      }
    }
  };
  assert.equal(sectionHasUserContent(cfg, 'trustBar'), false);
});

test('sectionHasUserContent detects scrolling sponsor tiles', function () {
  const cfg = {
    sections: {
      scrollingSponsorBanner: {
        on: true,
        instances: [{
          enabled: true,
          tiles: [{ enabled: true, name: 'Westpac', image: 'https://example.com/w.png' }]
        }]
      }
    }
  };
  assert.equal(sectionHasUserContent(cfg, 'scrollingSponsorBanner'), true);
});
