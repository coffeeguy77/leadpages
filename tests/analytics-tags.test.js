'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  parseGaMeasurementId,
  resolveGaMeasurementId,
  resolveAdsTagId,
  buildGtagHeadSnippet
} = require('../lib/analytics-tags');

describe('analytics tags', () => {
  it('parses GA4 ids from bare values and gtag snippets', () => {
    assert.equal(parseGaMeasurementId('G-ABC123xyz'), 'G-ABC123XYZ');
    assert.equal(
      parseGaMeasurementId(
        '<script async src="https://www.googletagmanager.com/gtag/js?id=G-Demo99"></script>'
      ),
      'G-DEMO99'
    );
    assert.equal(parseGaMeasurementId('gtag("config", "G-NESTED1");'), 'G-NESTED1');
    assert.equal(parseGaMeasurementId(''), '');
    assert.equal(parseGaMeasurementId('not a tag'), '');
  });

  it('resolves measurement id from site config analytics', () => {
    assert.equal(resolveGaMeasurementId({ analytics: { gaId: 'G-SITE1' } }), 'G-SITE1');
    assert.equal(resolveGaMeasurementId({ gaId: 'G-LEGACY' }), 'G-LEGACY');
    assert.equal(resolveAdsTagId({ googleAdsTagId: 'AW-123' }), 'AW-123');
  });

  it('builds a single gtag snippet for GA and Ads', () => {
    const html = buildGtagHeadSnippet(['G-AAA', 'AW-111']);
    assert.match(html, /gtag\/js\?id=G-AAA/);
    assert.match(html, /gtag\("config","G-AAA"\)/);
    assert.match(html, /gtag\("config","AW-111"\)/);
    assert.equal(buildGtagHeadSnippet([]), '');
  });

  it('ships Settings Google Analytics card beside Search & indexing', () => {
    const manage = fs.readFileSync(path.join(__dirname, '..', 'manage.html'), 'utf8');
    assert.match(manage, /id="ga-card"/);
    assert.match(manage, /ga-measurement-id/);
    assert.match(manage, /seoGaRow/);
    assert.match(manage, /lp-seo-ga-row/);
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib/analytics-tags.js')));
  });
});
