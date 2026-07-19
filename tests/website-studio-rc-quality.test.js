'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { composeWebsiteConcepts } = require('../lib/website-composer');
const { classifyBusiness } = require('../lib/website-composer/classify');
const { renderDraftPreviewHtml } = require('../lib/theme-studio/render-preview');

const RC_BRIEF = {
  businessName: 'RC Car Shop',
  industry: 'RC',
  businessType: 'Retail',
  specialisation: 'RC Car sales and service',
  location: 'Canberra',
  mainServices: 'RC Car sales and service',
  conversionGoal: 'Plan your visit',
  desiredStyle: 'Industrial, Premium, Dynamic multi terrain',
  preferredColours: ['#3a1f2b', '#f4efe8', '#c4a484'],
  notes: 'Hobby RC cars for multi-terrain fun.'
};

const TRADE_VISIBLE = [
  'kitchen sink',
  'what we fix',
  '212 five-star',
  'one call sorts',
  'tell us the problem',
  'speak to a',
  'call call',
  'blocked drain',
  'licensed canberra plumber'
];

describe('Website Studio — RC Car Shop quality bar', () => {
  it('classifies as hobby-retail, not automotive workshop', () => {
    const profile = classifyBusiness(RC_BRIEF);
    assert.equal(profile.profileId, 'hobby-retail');
    assert.equal(profile.preferredFoundationId, 'retail');
  });

  it('composes three distinct brand palettes with RC content and no trade shell copy', async () => {
    const result = await composeWebsiteConcepts(RC_BRIEF, {
      count: 3,
      allowMockImages: true,
      fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) })
    });
    assert.equal(result.ok, true, JSON.stringify(result.errors || [], null, 2));
    assert.equal(result.foundationId, 'retail');
    assert.equal(result.recipeId, 'recipe-hobby-retail');
    assert.equal(result.concepts.length, 3);

    const paletteKeys = new Set(
      result.concepts.map((c) => {
        const t = c.draftConfig.theme || {};
        return String(t.pipe) + '|' + String(t.hivis);
      })
    );
    assert.ok(paletteKeys.size >= 3, 'expected 3 distinct palettes, got ' + paletteKeys.size);

    for (const item of result.concepts) {
      const cfg = item.draftConfig;
      const services = cfg.sections.services || {};
      assert.ok((services.items || []).length >= 3);
      assert.notEqual(String(services.eyebrow || '').toLowerCase(), 'what we fix');
      assert.ok((cfg.sections.why && cfg.sections.why.items || []).length >= 3);
      assert.ok((cfg.sections.faq && cfg.sections.faq.items || []).length >= 2);
      assert.match(JSON.stringify(cfg.sections), /RC|hobby|parts|buggy|track/i);

      const html = renderDraftPreviewHtml(cfg, { mode: 'desktop' });
      assert.doesNotMatch(html, /Refusing to render/i);
      // Strip boot scripts / injected config before visible-copy checks
      const visible = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
      for (const term of TRADE_VISIBLE) {
        assert.ok(
          !visible.toLowerCase().includes(term),
          'visible trade residual: ' + term
        );
      }
      assert.match(visible, /RC Car Shop/i);
    }
  });

  it('neutral shell no longer ships kitchen-sink services copy', () => {
    const shell = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'landing-shell-neutral-v1.template.json'), 'utf8')
    ).html;
    assert.doesNotMatch(shell, /What we fix/i);
    assert.doesNotMatch(shell, /kitchen sink/i);
    assert.doesNotMatch(shell, /212 five-star/i);
    assert.doesNotMatch(shell, /Tell us the problem/i);
    assert.match(shell, /backgroundImage/);
  });
});
