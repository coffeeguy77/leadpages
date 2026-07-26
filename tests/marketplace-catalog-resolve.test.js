const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const resolve = require('../lib/marketplace-catalog-resolve');

const root = path.join(__dirname, '..');

describe('marketplace catalog resolve', () => {
  it('maps marketing hub slugs to section demos', () => {
    const quote = resolve.resolveFromStatic('quote-lead-capture');
    assert.equal(quote.feature.section_key, 'onlineQuote');
    assert.ok(resolve.hasPlayground(quote.blocks));
    assert.match(quote.blocks.find((b) => b.block_type === 'playground').payload.section_key, /onlineQuote/);

    const reviews = resolve.resolveFromStatic('reviews-trust');
    assert.equal(reviews.feature.section_key, 'reviews');
    assert.ok(resolve.hasPlayground(reviews.blocks));

    const promo = resolve.resolveFromStatic('promotions');
    assert.equal(promo.feature.section_key, 'specialOffer');
    assert.ok(resolve.hasPlayground(promo.blocks));
  });

  it('email-campaigns is a platform explainer without fake playground', () => {
    const email = resolve.resolveFromStatic('email-campaigns');
    assert.equal(email.feature.section_key, null);
    assert.equal(resolve.hasPlayground(email.blocks), false);
    assert.ok(email.blocks.some((b) => b.block_type === 'benefits'));
  });

  it('enriches thin DB rows with playground + section_key', () => {
    const thin = resolve.enrichCatalogPayload(
      { id: '1', slug: 'activity-counter', name: 'Activity Counter', status: 'live', section_key: null },
      [{ block_type: 'rich_text', payload: { heading: 'x', text: 'y' } }],
      'activity-counter'
    );
    assert.equal(thin.feature.section_key, 'activityCounter');
    assert.ok(resolve.hasPlayground(thin.blocks));
  });

  it('feature page client falls back for hub slugs and hero demo iframe', () => {
    const feat = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
    assert.match(feat, /quote-lead-capture/);
    assert.match(feat, /reviews-trust/);
    assert.match(feat, /email-campaigns/);
    assert.match(feat, /loadFeature/);
    assert.match(feat, /himg-demo-frame/);
    assert.match(feat, /ensurePlaygroundBlock/);
    assert.match(feat, /sell-templates\.json/);
  });

  it('activityCounter demo forces sections.on and shows stats', () => {
    const demo = fs.readFileSync(path.join(root, 'marketplace/demos/demo-activityCounter.html'), 'utf8');
    assert.match(demo, /"activityCounter"\s*:\s*\{/);
    assert.match(demo, /"on"\s*:\s*true/);
    assert.match(demo, /"stats"\s*:\s*\[/);
  });

  it('catalog API uses resolve helper', () => {
    const api = fs.readFileSync(path.join(root, 'api/catalog.js'), 'utf8');
    assert.match(api, /marketplace-catalog-resolve/);
    assert.match(api, /enrichCatalogPayload/);
  });
});
