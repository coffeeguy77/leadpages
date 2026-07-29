const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const featureHtml = fs.readFileSync(path.join(root, 'marketplace-feature.html'), 'utf8');
const featureCss = fs.readFileSync(path.join(root, 'assets/marketing-marketplace-feature.css'), 'utf8');

describe('marketplace feature app demo page', () => {
  it('uses Trust Bar–style key features instead of big benefit cards', () => {
    assert.match(featureHtml, /mf-key-features/);
    assert.match(featureHtml, /mf-kf-row/);
    assert.match(featureHtml, /function keyFeaturesHtml/);
    assert.doesNotMatch(featureHtml, /class="bn"/);
    assert.doesNotMatch(featureHtml, /mf-benefits/);
    assert.match(featureCss, /\.mf-kf-row/);
  });

  it('uses dual playground on desktop/tablet and stacked size buttons on phone', () => {
    assert.doesNotMatch(featureHtml, /pg-layoutbtns/);
    assert.doesNotMatch(featureHtml, /data-layout="portrait"/);
    assert.doesNotMatch(featureHtml, /data-layout="landscape"/);
    assert.doesNotMatch(featureHtml, /function setLayout/);
    assert.match(featureHtml, /data-layout="dual"/);
    assert.match(featureHtml, /pg-dual-strip/);
    assert.match(featureHtml, /pg-stage-shell/);
    assert.match(featureHtml, /function fitStage/);
    assert.match(featureHtml, /function detectViewportMode/);
    assert.match(featureHtml, /STAGE_W/);
    assert.match(featureHtml, /var layout = 'dual'/);
    assert.match(featureHtml, /var dev = 'tablet'/);
    assert.match(featureHtml, /function ensureDualMounted/);
    /* Desktop device button exists for phone browsers only */
    assert.match(featureHtml, /data-d="desktop"/);
    assert.match(featureHtml, /data-d="tablet"/);
    assert.match(featureHtml, /data-d="phone"/);
    assert.match(featureCss, /data-viewport="phone"/);
    assert.match(featureCss, /pg-stage-shell/);
    assert.match(featureCss, /pg-dev-desktop/);
    assert.match(featureHtml, /pg-preview-label/);
    assert.match(featureHtml, /function syncPreviewLabel/);
    assert.match(featureHtml, /Tablet preview/);
    assert.match(featureHtml, /Mobile preview/);
    assert.match(featureCss, /\.pg-preview-label/);
  });

  it('removes How it works and twin Ready / New CTA cards', () => {
    assert.doesNotMatch(featureHtml, /function howStepsHtml/);
    assert.doesNotMatch(featureHtml, /How it works/);
    assert.doesNotMatch(featureHtml, /function twinCtaHtml/);
    assert.doesNotMatch(featureHtml, /Ready when your website/);
    assert.doesNotMatch(featureHtml, /mf-cta-pair/);
  });

  it('puts Works better with + FAQ on a navy band', () => {
    assert.match(featureHtml, /mf-xsell-row/);
    assert.match(featureHtml, /Works even better with/);
    assert.match(featureHtml, /Questions about/);
    assert.match(featureCss, /\.mf-xsell-row\s*\{[^}]*#001529/s);
  });

  it('replaces the final dark opportunities banner with a light New to LeadPages sell', () => {
    assert.doesNotMatch(featureHtml, /Turn more website visits into real opportunities/);
    assert.doesNotMatch(featureHtml, /function finalBannerHtml/);
    assert.doesNotMatch(featureHtml, /mf-final/);
    assert.match(featureHtml, /function newToLeadPagesHtml/);
    assert.match(featureHtml, /mf-new-lp/);
    assert.match(featureHtml, /New to LeadPages\?/);
    assert.match(featureCss, /\.mf-new-lp\s*\{/);
  });

  it('keeps isOnlineQuote defined in render so hero chips do not throw', () => {
    const renderIdx = featureHtml.indexOf('function render(j)');
    assert.ok(renderIdx > 0);
    const renderSlice = featureHtml.slice(renderIdx, renderIdx + 9000);
    assert.match(renderSlice, /var isOnlineQuote=/);
    assert.match(renderSlice, /\+\(isOnlineQuote/);
  });
});
